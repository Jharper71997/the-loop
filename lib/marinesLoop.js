import { supabaseAdmin } from './supabaseAdmin'
import { operationalDateInTZ } from './schedule'
import { resolveScheduleStops } from './barsServer'

// The active Loop (Marines) weekend: the open (not closed-out) kind='marines'
// group for today, else the most recent that already ran, else the next
// upcoming. Mirrors getActiveAdminLoop (lib/upcomingLoops) but scoped to
// Marines and resolves stops from the inline schedule coords — Marine stops
// carry their own lat/lng and are NOT partner bars.
//
// Returns { groupId, eventId, eventStatus, name, eventDate, pickupTime, stops }
// or null. `stops` is [{ index, name, startTime, lat, lng, onBase }].
export async function getActiveMarinesLoop() {
  let sb
  try { sb = supabaseAdmin() } catch { return null }
  const today = operationalDateInTZ()

  const { data: groups } = await sb
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule, closed_out_at')
    .eq('kind', 'marines')
    .is('closed_out_at', null)
    .order('event_date', { ascending: true })

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

  // The loop's event (for ticket types / manifest). No status filter — the
  // driver + admin need it whether or not it's still on sale.
  const { data: ev } = await sb
    .from('events')
    .select('id, name, status, pickup_time')
    .eq('group_id', group.id)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const stops = await resolveScheduleStops(sb, group.schedule).catch(() => [])

  return {
    groupId: group.id,
    eventId: ev?.id || null,
    eventStatus: ev?.status || null,
    name: ev?.name || group.name || 'The Loop',
    eventDate: group.event_date || null,
    pickupTime: group.pickup_time || ev?.pickup_time || null,
    stops,
  }
}
