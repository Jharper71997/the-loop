import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isDoorPickupEvent, zoneOfTicketType, joinUrl, BASE_ZONE } from '@/lib/doorPickup'

export const metadata = { title: 'Door pickups' }
export const dynamic = 'force-dynamic'

const RED = '#f87171'
const GREEN = '#4ade80'
const MUTE = '#9c9ca3'

// The driver's boarding list for door pickup events (lib/doorPickup.js). Every
// group by departure slot, with the address, and EVERY rider by name marked
// PAID or NOT PAID. A friend the organizer listed who has not paid their own
// seat does not board until they pay. That is the point of this page.
export default async function PickupsPage() {
  const sb = supabaseAdmin()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

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
      .select('id, event_id, buyer_name, buyer_phone, metadata, paid_at, order_items(ticket_type_id, voided_at, rider_first_name, rider_last_name, claim_token, claimed_at)')
      .in('event_id', doorEvents.map(e => e.id))
      .eq('status', 'paid')
    : { data: [] }

  const liveItems = o => (o.order_items || []).filter(i => !i.voided_at)
  const itemName = (i, o, idx) => [i.rider_first_name, i.rider_last_name].filter(Boolean).join(' ')
    || (idx === 0 ? o.buyer_name : null)
    || (i.claim_token && !i.claimed_at ? `Guest of ${o.buyer_name || 'organizer'}` : 'Rider')

  // Every group's boarding rows, computed once so the totals up top match.
  const board = doorEvents.map(ev => {
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
          const rows = [
            ...liveItems(o).map((i, idx) => ({ name: itemName(i, o, idx), paid: true, by: idx === 0 ? 'organizer' : `paid by ${o.buyer_name || 'organizer'}` })),
            ...joiners.flatMap(j => liveItems(j).map((i, idx) => ({ name: itemName(i, j, idx), paid: true, by: 'paid own seat' }))),
            ...(Array.isArray(d.roster) ? d.roster : [])
              .filter(f => !paidTokens.has(f.token))
              .map(f => ({
                name: [f.first_name, f.last_name].filter(Boolean).join(' '),
                paid: false, phone: f.phone,
                link: `${joinUrl(ev.id, d.join_code)}&seat=${f.token}`,
              })),
          ]
          return { o, d, rows, unpaid: rows.filter(r => !r.paid).length }
        })
        return { slot, groups }
      })
    return { ev, slots }
  })
  const totalUnpaid = board.reduce((s, b) => s + b.slots.reduce((t, sl) => t + sl.groups.reduce((u, g) => u + g.unpaid, 0), 0), 0)

  return (
    <main style={{ padding: 16, maxWidth: 960, margin: '0 auto', color: '#f5f5f7' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 6px' }}>Door pickups</h1>
      <p style={{ color: MUTE, fontSize: 14, margin: '0 0 14px', lineHeight: 1.5 }}>
        Check every name before anyone boards. <strong style={{ color: RED }}>NOT PAID</strong> does not get on the bus
        until they pay at their link (tap it and hand them the phone, or text it to them).
      </p>
      {totalUnpaid > 0 && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(248,113,113,0.12)', border: `1px solid ${RED}`, color: RED, fontWeight: 800, marginBottom: 18 }}>
          {totalUnpaid} rider{totalUnpaid === 1 ? '' : 's'} not paid yet
        </div>
      )}
      {!doorEvents.length && <p style={{ color: MUTE }}>No upcoming door pickup events.</p>}
      {board.map(({ ev, slots }) => (
        <section key={ev.id} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>{ev.name}</h2>
          <div style={{ color: MUTE, fontSize: 13, marginBottom: 12 }}>{ev.event_date}</div>
          {slots.map(({ slot, groups }) => {
            const seats = groups.reduce((s, g) => s + g.rows.length, 0)
            return (
              <div key={slot.id} style={{ borderTop: '1px solid #2a2a31', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{slot.name}</strong>
                  <span style={{ color: seats ? '#d4a333' : MUTE, fontSize: 13 }}>
                    {seats} / {slot.capacity ?? 13} seats · Zone {zoneOfTicketType(slot)}
                  </span>
                </div>
                {groups.map(({ o, d, rows, unpaid }) => {
                  const addr = [d.street, d.city, d.zip].filter(Boolean).join(', ')
                  return (
                    <div key={o.id} style={{
                      margin: '10px 0 0', padding: '12px 14px', borderRadius: 12,
                      border: `1px solid ${unpaid ? RED : '#2a2a31'}`, fontSize: 14, lineHeight: 1.5,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <strong>{o.buyer_name || 'Group'}</strong>
                        <strong style={{ color: unpaid ? RED : GREEN }}>
                          {unpaid ? `${unpaid} NOT PAID` : 'All paid'} · {rows.length - unpaid} of {rows.length}
                        </strong>
                      </div>
                      <div>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`} style={{ color: '#f5f5f7' }}>{addr || 'no address'}</a>
                        {o.buyer_phone && <> · <a href={`tel:${o.buyer_phone}`} style={{ color: '#d4a333' }}>{o.buyer_phone}</a></>}
                      </div>
                      {!d.geo && <div style={{ color: RED }}>Address not verified on the map. Check it before the run.</div>}
                      {d.zone === BASE_ZONE && <div style={{ color: '#d4a333', fontWeight: 700 }}>On base: check every rider&rsquo;s military or dependent ID before they board.</div>}
                      {d.notes && <div style={{ color: MUTE }}>Note: {d.notes}</div>}
                      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6 }}>
                        {rows.map((r, i) => (
                          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span>
                              <strong style={{ color: r.paid ? GREEN : RED }}>{r.paid ? '✓ PAID' : '✗ NOT PAID'}</strong>{' '}
                              {r.name} <span style={{ color: MUTE, fontSize: 12.5 }}>{r.paid ? r.by : r.phone}</span>
                            </span>
                            {!r.paid && (
                              <span style={{ display: 'flex', gap: 8 }}>
                                <a href={r.link} style={pill}>Pay now</a>
                                <a href={`sms:${r.phone || ''}?&body=${encodeURIComponent(`Pay your $10 Oktoberfest seat before you board: ${r.link}`)}`} style={pill}>Text link</a>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>
      ))}
    </main>
  )
}

const pill = {
  padding: '5px 12px', borderRadius: 999, background: '#d4a333', color: '#111',
  fontWeight: 800, fontSize: 12.5, textDecoration: 'none',
}
