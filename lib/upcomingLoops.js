import { supabaseAdmin } from './supabaseAdmin'

// Returns the list of upcoming rider-visible loops.
//
// Public /events should ONLY show events that the admin has explicitly put
// on sale (events.status = 'on_sale'). Anything in draft or orphan group
// rows stay admin-only, so admin can stage future dates without leaking
// them to riders.
//
//   { kind: 'event', id, groupId, name, eventDate, pickupTime, coverImageUrl, fromPriceCents }
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
      .select('id, group_id, name, event_date, pickup_time, cover_image_url, status, ticket_types(price_cents, active)')
      .eq('status', 'on_sale')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
  } catch (err) {
    console.error('[upcomingLoops] queries threw', err)
    return []
  }

  if (eventsRes?.error) console.error('[upcomingLoops] events error', eventsRes.error)

  const events = eventsRes?.data || []

  return events
    .map(e => {
      const prices = (e.ticket_types || [])
        .filter(t => t.active)
        .map(t => t.price_cents)
        .sort((a, b) => a - b)
      return {
        kind: 'event',
        id: e.id,
        groupId: e.group_id,
        name: e.name,
        eventDate: e.event_date,
        pickupTime: e.pickup_time,
        coverImageUrl: e.cover_image_url,
        fromPriceCents: prices[0] ?? null,
      }
    })
    .sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''))
    .slice(0, limit)
}
