import { isDoorPickupEvent, zoneOfTicketType, joinUrl, BASE_ZONE } from '@/lib/doorPickup'

// The driver's boarding list for door pickup events (lib/doorPickup.js), shown
// on the Loops page: every group by pickup hour, with the address, and EVERY
// rider by name marked paid or not. A friend the organizer listed who has not
// paid their own seat does not board until they pay.
export async function buildDoorPickupBoard(sb) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const { data: events } = await sb
    .from('events')
    .select('id, name, event_date, kind, is_private, group_id, status, ticket_types(id, name, active, sort_order, capacity)')
    .gte('event_date', today)
    .is('group_id', null)
    .order('event_date', { ascending: true })

  const doorEvents = (events || []).filter(e => isDoorPickupEvent(e, e.ticket_types))
  if (!doorEvents.length) return []

  const { data: orders } = await sb
    .from('orders')
    .select('id, event_id, buyer_name, buyer_phone, metadata, paid_at, order_items(ticket_type_id, voided_at, rider_first_name, rider_last_name, claim_token, claimed_at)')
    .in('event_id', doorEvents.map(e => e.id))
    .eq('status', 'paid')

  const liveItems = o => (o.order_items || []).filter(i => !i.voided_at)
  const itemName = (i, o, idx) => [i.rider_first_name, i.rider_last_name].filter(Boolean).join(' ')
    || (idx === 0 ? o.buyer_name : null)
    || (i.claim_token && !i.claimed_at ? `Guest of ${o.buyer_name || 'organizer'}` : 'Rider')

  return doorEvents.map(ev => {
    const evOrders = (orders || []).filter(o => o.event_id === ev.id)
    const slots = (ev.ticket_types || [])
      .filter(t => t.active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(slot => {
        const inSlot = evOrders.filter(o => liveItems(o).some(i => i.ticket_type_id === slot.id))
        const groups = inSlot.filter(o => !o.metadata?.door_pickup?.party_of).map(o => {
          const d = o.metadata?.door_pickup || {}
          const joiners = inSlot.filter(j => j.metadata?.door_pickup?.party_of === o.id)
          const paidTokens = new Set(joiners.map(j => j.metadata?.door_pickup?.seat_token).filter(Boolean))
          const riders = [
            ...liveItems(o).map((i, idx) => ({ name: itemName(i, o, idx), paid: true, by: idx === 0 ? 'organizer' : `paid by ${o.buyer_name || 'organizer'}` })),
            ...joiners.flatMap(j => liveItems(j).map((i, idx) => ({ name: itemName(i, j, idx), paid: true, by: 'paid own seat' }))),
            ...(Array.isArray(d.roster) ? d.roster : [])
              .filter(f => !paidTokens.has(f.token))
              .map(f => ({
                name: [f.first_name, f.last_name].filter(Boolean).join(' '),
                paid: false, phone: f.phone || null,
                link: `${joinUrl(ev.id, d.join_code)}&seat=${f.token}`,
              })),
          ]
          return {
            id: o.id,
            organizer: o.buyer_name || 'Group',
            phone: o.buyer_phone || null,
            address: [d.street, d.city, d.zip].filter(Boolean).join(', '),
            verified: !!d.geo,
            onBase: d.zone === BASE_ZONE,
            notes: d.notes || null,
            riders,
            unpaid: riders.filter(r => !r.paid).length,
          }
        })
        return {
          id: slot.id, name: slot.name, zone: zoneOfTicketType(slot), capacity: slot.capacity ?? 13,
          seats: groups.reduce((s, g) => s + g.riders.length, 0),
          groups,
        }
      })
    return {
      id: ev.id, name: ev.name, event_date: ev.event_date, slots,
      seats: slots.reduce((s, sl) => s + sl.seats, 0),
      unpaid: slots.reduce((s, sl) => s + sl.groups.reduce((u, g) => u + g.unpaid, 0), 0),
    }
  })
}
