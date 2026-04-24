import { supabaseAdmin } from './supabaseAdmin'

// Returns the list of upcoming rider-visible loops.
//
// A "loop" on the rider side is either:
//   - an on-sale event (bookable, has ticket_types) — shown with a Book CTA, or
//   - a scheduled group with no event yet (coming soon) — shown as a teaser
//     so admin-planned dates aren't invisible to the public while ticketing
//     is being set up.
//
// Returns an array sorted by event_date ascending:
//   { kind: 'event', id, groupId, name, eventDate, pickupTime, coverImageUrl, fromPriceCents }
//   { kind: 'group', id,              name, eventDate, pickupTime, coverImageUrl: null, fromPriceCents: null }
export async function getUpcomingLoops({ limit = 12 } = {}) {
  const sb = supabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const [eventsRes, groupsRes] = await Promise.all([
    sb
      .from('events')
      .select('id, group_id, name, event_date, pickup_time, cover_image_url, status, ticket_types(price_cents, active)')
      .eq('status', 'on_sale')
      .gte('event_date', today)
      .order('event_date', { ascending: true }),
    sb
      .from('groups')
      .select('id, name, event_date, pickup_time')
      .gte('event_date', today)
      .order('event_date', { ascending: true }),
  ])

  const events = eventsRes.data || []
  const groups = groupsRes.data || []

  const coveredGroupIds = new Set(events.map(e => e.group_id).filter(Boolean))

  const eventLoops = events.map(e => {
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

  const groupLoops = groups
    .filter(g => !coveredGroupIds.has(g.id))
    .map(g => ({
      kind: 'group',
      id: g.id,
      name: g.name,
      eventDate: g.event_date,
      pickupTime: g.pickup_time,
      coverImageUrl: null,
      fromPriceCents: null,
    }))

  return [...eventLoops, ...groupLoops]
    .sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''))
    .slice(0, limit)
}
