import { supabaseAdmin } from './supabaseAdmin'
import { lookupBarsByNames } from './barsServer'
import { operationalDateInTZ } from './schedule'

const TZ = 'America/Indiana/Indianapolis'

// Loops run past midnight, so the rider-facing "day" doesn't end until 4 AM ET.
// Shifting the clock back 4 hours before taking the ET date means a Friday loop
// (event_date = Friday) keeps matching `event_date >= today` until 4:00 AM
// Saturday, instead of vanishing at midnight while the loop is still running.
const ROLLOVER_HOUR = 4

function todayInIndianapolis() {
  const shifted = new Date(Date.now() - ROLLOVER_HOUR * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(shifted)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

// Returns the list of upcoming rider-visible loops.
//
// Public /events should ONLY show events that the admin has explicitly put
// on sale (events.status = 'on_sale'). Anything in draft or orphan group
// rows stay admin-only, so admin can stage future dates without leaking
// them to riders.
//
// stops is the per-event pickup-bar list, derived from active ticket_types
// (each ticket type IS a pickup bar). Order follows ticket_types.sort_order;
// startTime is pulled from groups.schedule[stop_index] when available.
// Each entry: { name, slug, startTime }. slug is null when the ticket-type
// name doesn't match a known partner bar.
//
//   { kind: 'event', id, groupId, name, eventDate, pickupTime, coverImageUrl, fromPriceCents, stops }
export async function getUpcomingLoops({ limit = 12 } = {}) {
  let sb
  try {
    sb = supabaseAdmin()
  } catch (err) {
    console.error('[upcomingLoops] supabaseAdmin init failed', err)
    return []
  }
  // "Today" in Indianapolis local time. Plain UTC slicing rolls over to
  // tomorrow's date around 7-8 PM Eastern, which silently hides tonight's
  // loop from /events, /admin/driver, and the dispatch view mid-shift.
  const today = todayInIndianapolis()

  let eventsRes
  try {
    eventsRes = await sb
      .from('events')
      .select('id, group_id, name, event_date, pickup_time, cover_image_url, status, ticket_types(name, price_cents, active, stop_index, sort_order), groups(schedule)')
      .eq('status', 'on_sale')
      .eq('kind', 'brew')   // never surface a Marines loop on the Brew Loop /events feed
      .gte('event_date', today)
      .order('event_date', { ascending: true })
  } catch (err) {
    console.error('[upcomingLoops] queries threw', err)
    return []
  }

  if (eventsRes?.error) console.error('[upcomingLoops] events error', eventsRes.error)

  const events = eventsRes?.data || []

  // Strip "pickup" / parenthetical suffixes etc from ticket-type names so
  // "The Angry Ginger pickup" displays as "The Angry Ginger" on chips.
  const cleanBarName = raw => String(raw || '')
    .replace(/\s*[—–-]\s*\$?\d.*$/i, '')          // trim "— $20" tails
    .replace(/\s*\(.*?\)\s*/g, ' ')                // drop parentheticals
    .replace(/\s+pick[\s-]?up\s*$/i, '')           // drop trailing "pickup"
    .replace(/\s+stop\s*$/i, '')                   // drop trailing "stop"
    .replace(/\s+/g, ' ')
    .trim()

  // One bar lookup for every distinct ticket-type name across all upcoming
  // events, so chips can resolve to a known partner bar slug.
  const allNames = new Set()
  for (const e of events) {
    const types = Array.isArray(e.ticket_types) ? e.ticket_types : []
    for (const t of types) {
      if (!t?.active) continue
      const cleaned = cleanBarName(t.name)
      if (cleaned) allNames.add(cleaned)
    }
  }
  let barLookup = new Map()
  if (allNames.size) {
    try {
      barLookup = await lookupBarsByNames(sb, [...allNames])
    } catch (err) {
      console.error('[upcomingLoops] bar lookup failed', err)
    }
  }

  return events
    .map(e => {
      const activeTypes = (e.ticket_types || []).filter(t => t.active)
      const prices = activeTypes
        .map(t => t.price_cents)
        .sort((a, b) => a - b)
      const sched = Array.isArray(e.groups?.schedule) ? e.groups.schedule : []
      const stops = activeTypes
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(t => {
          const cleaned = cleanBarName(t.name)
          const sIdx = Number.isFinite(t.stop_index) ? t.stop_index : null
          return {
            name: cleaned || t.name,
            slug: cleaned ? barLookup.get(cleaned)?.slug ?? null : null,
            startTime: sIdx != null ? sched[sIdx]?.start_time || null : null,
          }
        })
        .filter(s => s.name)
      return {
        kind: 'event',
        id: e.id,
        groupId: e.group_id,
        name: e.name,
        eventDate: e.event_date,
        pickupTime: e.pickup_time,
        coverImageUrl: e.cover_image_url,
        fromPriceCents: prices[0] ?? null,
        stops,
      }
    })
    .sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''))
    .slice(0, limit)
}

// Admin-side "which loop are we running right now?" — unlike getUpcomingLoops
// (rider-facing, date-cutoff), this ignores the date entirely and returns the
// loop that is still OPEN (groups.closed_out_at IS NULL). A loop that already
// ran stays the active loop until staff close it out, which is what keeps the
// driver numbers / route log on screen past midnight.
//
//   { groupId, id (eventId|null), name, eventDate, pickupTime } | null
export async function getActiveAdminLoop() {
  let sb
  try { sb = supabaseAdmin() } catch (err) {
    console.error('[activeAdminLoop] init failed', err)
    return null
  }
  const today = operationalDateInTZ()

  const { data: groups, error } = await sb
    .from('groups')
    .select('id, name, event_date, pickup_time, closed_out_at')
    .eq('kind', 'brew')   // Brew Loop driver/admin only — Marines has its own active-loop loader
    .is('closed_out_at', null)
    .order('event_date', { ascending: true })
  if (error) {
    console.error('[activeAdminLoop] groups error', error)
    return null
  }

  const open = groups || []
  const todayG = open.find(g => g.event_date === today)
  const ran = !todayG
    ? open.filter(g => g.event_date && g.event_date < today)
        .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))[0]
    : null
  const next = (!todayG && !ran)
    ? open.filter(g => !g.event_date || g.event_date > today)
        .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))[0]
    : null
  const group = todayG || ran || next
  if (!group) return null

  // Resolve the loop's event (for route_stop_logs etc). No status filter — the
  // driver needs it whether or not it's still on sale to riders.
  const { data: ev } = await sb
    .from('events')
    .select('id, name')
    .eq('group_id', group.id)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    groupId: group.id,
    id: ev?.id || null,
    name: ev?.name || group.name || null,
    eventDate: group.event_date || null,
    pickupTime: group.pickup_time || null,
  }
}
