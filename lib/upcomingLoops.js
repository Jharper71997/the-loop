import { supabaseAdmin } from './supabaseAdmin'
import { lookupBarsByNames } from './barsServer'

// Returns the list of upcoming rider-visible loops.
//
// Public /events should ONLY show events that the admin has explicitly put
// on sale (events.status = 'on_sale'). Anything in draft or orphan group
// rows stay admin-only, so admin can stage future dates without leaking
// them to riders.
//
// stops is the per-event route, derived from groups.schedule (set by admin).
// Each entry: { name, slug, startTime }. slug is null when the schedule
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
  const today = new Date().toISOString().slice(0, 10)

  let eventsRes
  try {
    eventsRes = await sb
      .from('events')
      .select('id, group_id, name, event_date, pickup_time, cover_image_url, status, ticket_types(price_cents, active), groups(schedule)')
      .eq('status', 'on_sale')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
  } catch (err) {
    console.error('[upcomingLoops] queries threw', err)
    return []
  }

  if (eventsRes?.error) console.error('[upcomingLoops] events error', eventsRes.error)

  const events = eventsRes?.data || []

  // One bar lookup for every distinct schedule name across all upcoming
  // events, so the rider-visible chip rows match what /track shows.
  const allNames = new Set()
  for (const e of events) {
    const sched = Array.isArray(e.groups?.schedule) ? e.groups.schedule : []
    for (const s of sched) {
      if (s?.name) allNames.add(s.name)
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
      const prices = (e.ticket_types || [])
        .filter(t => t.active)
        .map(t => t.price_cents)
        .sort((a, b) => a - b)
      const sched = Array.isArray(e.groups?.schedule) ? e.groups.schedule : []
      const stops = sched
        .filter(s => s?.name)
        .map(s => ({
          name: s.name,
          slug: barLookup.get(s.name)?.slug ?? null,
          startTime: s.start_time || null,
        }))
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
