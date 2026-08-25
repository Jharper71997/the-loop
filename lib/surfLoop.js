import { supabaseAdmin } from './supabaseAdmin'
import { operationalDateInTZ } from './schedule'
import { resolveScheduleStops } from './barsServer'

// Surf City Loop selectors. Mirrors lib/marinesLoop.js but scoped to
// kind='surf' and business='surf' bars. The big difference from Brew/Marines:
// Surf runs MULTIPLE loops per weekend day (Sat day + transition + night), so
// we expose getSurfLoopsForDay() (all loops on the active day) in addition to
// getActiveSurfLoop() (the single primary one for single-loop contexts).

// Pick the "active" service date among open (not closed-out) surf groups:
// today if any run today, else the most recent that already ran, else the
// next upcoming. Returns { date, groups: [...] } or null.
async function activeDay(sb) {
  const today = operationalDateInTZ()
  const { data: groups } = await sb
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule, closed_out_at')
    .eq('kind', 'surf')
    .is('closed_out_at', null)
    .order('event_date', { ascending: true })
    .order('pickup_time', { ascending: true })

  const open = groups || []
  if (!open.length) return null

  const dates = [...new Set(open.map(g => g.event_date).filter(Boolean))]
  let date = dates.find(d => d === today)
  if (!date) {
    const past = dates.filter(d => d < today).sort((a, b) => b.localeCompare(a))
    const future = dates.filter(d => d > today).sort((a, b) => a.localeCompare(b))
    date = past[0] || future[0] || null
  }
  // Groups with no date fall through to the chosen date only if nothing else.
  const onDay = date ? open.filter(g => g.event_date === date) : open
  return { date, groups: onDay }
}

// Resolve one group into the shape rider/staff surfaces expect.
async function resolveLoop(sb, group) {
  const { data: ev } = await sb
    .from('events')
    .select('id, name, status, pickup_time')
    .eq('group_id', group.id)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const stops = await resolveScheduleStops(sb, group.schedule, { business: 'surf' }).catch(() => [])

  return {
    groupId: group.id,
    eventId: ev?.id || null,
    eventStatus: ev?.status || null,
    name: ev?.name || group.name || 'Surf City Loop',
    eventDate: group.event_date || null,
    pickupTime: group.pickup_time || ev?.pickup_time || null,
    stops,
  }
}

// All Surf City loops on the active service day (sorted by pickup time).
// [{ groupId, eventId, eventStatus, name, eventDate, pickupTime, stops }]
export async function getSurfLoopsForDay() {
  let sb
  try { sb = supabaseAdmin() } catch { return [] }
  const day = await activeDay(sb)
  if (!day || !day.groups.length) return []
  return Promise.all(day.groups.map(g => resolveLoop(sb, g)))
}

// The single primary Surf City loop (earliest by pickup time on the active
// day). For single-loop contexts (track default, headers). null if none.
export async function getActiveSurfLoop() {
  const loops = await getSurfLoopsForDay()
  return loops[0] || null
}
