import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isDoorPickupEvent, zoneOfTicketType, joinUrl, DOOR_PICKUP_MIN_RIDERS } from '@/lib/doorPickup'

export const metadata = { title: 'Door pickups' }
export const dynamic = 'force-dynamic'

// The driver's run sheet for door pickup events (lib/doorPickup.js): every
// paid group, by departure slot, with the address and a map link. One slot is
// one run in one zone.
export default async function PickupsPage() {
  const sb = supabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const { data: events } = await sb
    .from('events')
    .select('id, name, event_date, kind, is_private, group_id, status, ticket_types(id, name, active, sort_order, capacity)')
    .gte('event_date', today)
    .is('group_id', null)
    .order('event_date', { ascending: true })

  const doorEvents = (events || []).filter(e => isDoorPickupEvent(e, e.ticket_types))

  const { data: orders } = doorEvents.length
    ? await sb
      .from('orders')
      .select('id, event_id, buyer_name, buyer_phone, party_size, metadata, paid_at, order_items(ticket_type_id, voided_at)')
      .in('event_id', doorEvents.map(e => e.id))
      .eq('status', 'paid')
    : { data: [] }

  return (
    <main style={{ padding: 16, maxWidth: 960, margin: '0 auto', color: '#f5f5f7' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 16px' }}>Door pickups</h1>
      {!doorEvents.length && <p style={{ color: '#9c9ca3' }}>No upcoming door pickup events.</p>}
      {doorEvents.map(ev => {
        const slots = (ev.ticket_types || [])
          .filter(t => t.active)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const evOrders = (orders || []).filter(o => o.event_id === ev.id)
        return (
          <section key={ev.id} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>{ev.name}</h2>
            <div style={{ color: '#9c9ca3', fontSize: 13, marginBottom: 12 }}>{ev.event_date} · {ev.status}</div>
            {slots.map(slot => {
              const live = o => (o.order_items || []).filter(i => !i.voided_at).length
              const inSlot = evOrders.filter(o => (o.order_items || []).some(i => i.ticket_type_id === slot.id && !i.voided_at))
              // Organizers, each with the friends who joined and paid their own seat.
              const groups = inSlot.filter(o => !o.metadata?.door_pickup?.party_of).map(o => ({
                ...o, joiners: inSlot.filter(j => j.metadata?.door_pickup?.party_of === o.id),
              }))
              const seats = groups.reduce((s, o) => s + (o.order_items || []).filter(i => !i.voided_at).length, 0)
              return (
                <div key={slot.id} style={{ borderTop: '1px solid #2a2a31', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{slot.name}</strong>
                    <span style={{ color: seats ? '#d4a333' : '#9c9ca3', fontSize: 13 }}>
                      {seats} / {slot.capacity ?? 13} seats · Zone {zoneOfTicketType(slot)}
                    </span>
                  </div>
                  {groups.map(o => {
                    const d = o.metadata?.door_pickup || {}
                    const total = live(o) + o.joiners.reduce((s, j) => s + live(j), 0)
                    const addr = [d.street, d.city, d.zip].filter(Boolean).join(', ')
                    return (
                      <div key={o.id} style={{ fontSize: 14, padding: '8px 0 0 12px', lineHeight: 1.5 }}>
                        <div>
                          {o.buyer_name || 'Group'} · <strong style={{ color: total < DOOR_PICKUP_MIN_RIDERS ? '#f87171' : '#f5f5f7' }}>{total} riders</strong>
                          {total < DOOR_PICKUP_MIN_RIDERS ? ' (under 4)' : ''} ·{' '}
                          {o.buyer_phone ? <a href={`tel:${o.buyer_phone}`} style={{ color: '#d4a333' }}>{o.buyer_phone}</a> : 'no phone'}
                        </div>
                        <div>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`} style={{ color: '#f5f5f7' }}>{addr || 'no address'}</a>
                        </div>
                        {d.geo
                          ? <div style={{ color: '#9c9ca3' }}>{d.geo.miles} mi from the depot</div>
                          : <div style={{ color: '#f87171' }}>Address not verified on the map. Check it before the run.</div>}
                        {d.notes && <div style={{ color: '#9c9ca3' }}>Note: {d.notes}</div>}
                        {o.joiners.map(j => (
                          <div key={j.id} style={{ color: '#9c9ca3' }}>+ {j.buyer_name || 'Friend'} · {live(j)} paid their own · {j.buyer_phone || ''}</div>
                        ))}
                        {d.join_code && <div style={{ color: '#6c6c74', fontSize: 12, wordBreak: 'break-all' }}>Group link: {joinUrl(ev.id, d.join_code)}</div>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </section>
        )
      })}
    </main>
  )
}
