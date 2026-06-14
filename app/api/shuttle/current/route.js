import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { operationalDateInTZ } from '@/lib/schedule'
import { lookupBarsByNames } from '@/lib/barsServer'
import { haversineMeters } from '@/lib/geo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shuttle/current — public.
// Returns the most recent shuttle_pings row from the last 5 minutes, or null
// if the shuttle is off duty / hasn't reported recently. /track polls this
// every ~10s.
//
// Also returns `next_stop` — preferred source is the driver's per-stop log
// (route_stop_logs). When the driver forgets to tap "arrived" all night, we
// fall back to a position-derived next stop computed from shuttle_pings
// geography so the rider card still tracks the bus.
const STALE_AFTER_MS = 5 * 60 * 1000

// Position-fallback constants.
//   - A ping within VISIT_RADIUS_M of a bar counts toward a "visit".
//   - A bar is considered VISITED only after >= MIN_VISIT_PINGS pings spanning
//     MIN_VISIT_DURATION_MS, so a drive-by past the parking lot doesn't trip
//     the counter.
//   - PING_LOOKBACK_MS bounds the ping scan to the current loop's runtime.
const VISIT_RADIUS_M = 80
const MIN_VISIT_PINGS = 2
const MIN_VISIT_DURATION_MS = 60_000
const PING_LOOKBACK_MS = 8 * 60 * 60 * 1000

export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shuttle_pings')
    .select('lat, lng, speed_mph, heading, is_active, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return Response.json({ shuttle: null, error: error.message }, { status: 500 })
  }

  const nextStop = await loadNextStop(admin).catch(() => null)

  if (!data) {
    return Response.json({ shuttle: null, next_stop: nextStop })
  }

  const age = Date.now() - new Date(data.recorded_at).getTime()
  if (age > STALE_AFTER_MS || !data.is_active) {
    return Response.json({ shuttle: null, last_seen_at: data.recorded_at, next_stop: nextStop })
  }

  return Response.json({ shuttle: data, next_stop: nextStop })
}

async function loadNextStop(admin) {
  // Eastern operational date: keeps tonight's event in scope until 9 AM the
  // next morning. Plain UTC slicing rolls over at 8 PM EDT mid-shift.
  const today = operationalDateInTZ()
  const { data: eventRow } = await admin
    .from('events')
    .select('id, group_id')
    .eq('status', 'on_sale')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!eventRow?.id) return null

  const logged = await loadLoggedNextStop(admin, eventRow.id)
  if (logged) return logged

  return loadPositionDerivedNextStop(admin, eventRow.group_id)
}

// Driver-tap source of truth: as the driver marks each bar arrived, advance
// to the lowest stop_index whose actual_arrival_at is still null. We only
// trust this branch if SOME arrival has been logged — otherwise the seeded
// rows always point at cycle-1 stop 1 and the card never advances.
async function loadLoggedNextStop(admin, eventId) {
  const { data: anyArrival } = await admin
    .from('route_stop_logs')
    .select('id')
    .eq('event_id', eventId)
    .not('actual_arrival_at', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!anyArrival) return null

  const { data: row } = await admin
    .from('route_stop_logs')
    .select('bar_name, bar_slug, stop_index, cycle_index, bar_position, scheduled_at')
    .eq('event_id', eventId)
    .is('actual_arrival_at', null)
    .order('stop_index', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!row) return null

  return {
    bar_name: row.bar_name,
    bar_slug: row.bar_slug,
    stop_index: row.stop_index,
    cycle_index: row.cycle_index,
    bar_position: row.bar_position,
    scheduled_at: row.scheduled_at,
  }
}

// Position fallback: derive the next stop from shuttle_pings. Counts how
// many bars in the cycle-1 schedule the bus has visited (pings within
// VISIT_RADIUS_M for at least MIN_VISIT_DURATION_MS), and points at the
// next one in schedule order.
async function loadPositionDerivedNextStop(admin, groupId) {
  if (!groupId) return null

  const { data: group } = await admin
    .from('groups')
    .select('schedule')
    .eq('id', groupId)
    .maybeSingle()
  const schedule = Array.isArray(group?.schedule) ? group.schedule : []
  const named = schedule.map(s => s?.name).filter(Boolean)
  if (!named.length) return null

  const barLookup = await lookupBarsByNames(admin, named).catch(() => new Map())
  const placed = schedule
    .map(s => {
      const bar = s?.name ? barLookup.get(s.name) : null
      return {
        name: s?.name || '',
        slug: bar?.slug ?? null,
        lat: Number.isFinite(bar?.lat) ? bar.lat : null,
        lng: Number.isFinite(bar?.lng) ? bar.lng : null,
      }
    })
    .filter(s => s.name && s.lat != null && s.lng != null)
  if (!placed.length) return null

  const since = new Date(Date.now() - PING_LOOKBACK_MS).toISOString()
  const { data: pings } = await admin
    .from('shuttle_pings')
    .select('lat, lng, recorded_at')
    .gte('recorded_at', since)
    .eq('is_active', true)
    .order('recorded_at', { ascending: true })

  const visitedCount = countVisitedBars(placed, pings || [])
  if (visitedCount >= placed.length) return null

  const next = placed[visitedCount]
  return {
    bar_name: next.name,
    bar_slug: next.slug,
    stop_index: visitedCount + 1,
    cycle_index: null,
    bar_position: null,
    scheduled_at: null,
  }
}

// A bar is "visited" once it accumulates >= MIN_VISIT_PINGS pings within
// VISIT_RADIUS_M, spanning >= MIN_VISIT_DURATION_MS between earliest and
// latest. Returns the number of leading bars in schedule order that have
// been visited (stops counting at the first un-visited bar so a future-bar
// drive-by doesn't skip the current stop).
function countVisitedBars(bars, pings) {
  const earliest = new Array(bars.length).fill(null)
  const latest = new Array(bars.length).fill(null)
  const counts = new Array(bars.length).fill(0)

  for (const p of pings) {
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) continue
    const t = new Date(p.recorded_at).getTime()
    if (!Number.isFinite(t)) continue
    for (let i = 0; i < bars.length; i++) {
      if (haversineMeters(p.lat, p.lng, bars[i].lat, bars[i].lng) <= VISIT_RADIUS_M) {
        counts[i]++
        if (earliest[i] == null || t < earliest[i]) earliest[i] = t
        if (latest[i] == null || t > latest[i]) latest[i] = t
      }
    }
  }

  let n = 0
  for (let i = 0; i < bars.length; i++) {
    const visited = counts[i] >= MIN_VISIT_PINGS
      && earliest[i] != null
      && latest[i] != null
      && (latest[i] - earliest[i]) >= MIN_VISIT_DURATION_MS
    if (!visited) break
    n++
  }
  return n
}
