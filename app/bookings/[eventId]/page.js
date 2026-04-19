import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export default async function EventAdmin({ params }) {
  const { eventId } = await params
  const supabase = supabaseAdmin()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date, pickup_time, description, status, capacity, group_id')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) notFound()

  const [{ data: ticketTypes }, { data: orders }] = await Promise.all([
    supabase
      .from('ticket_types')
      .select('id, name, price_cents, capacity, stop_index, sort_order, active')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('orders')
      .select('id, buyer_name, buyer_phone, buyer_email, total_cents, status, party_size, paid_at, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
  ])

  const paidOrders = (orders || []).filter(o => o.status === 'paid')
  const ticketCount = paidOrders.reduce((s, o) => s + (o.party_size || 0), 0)
  const revenue = paidOrders.reduce((s, o) => s + (o.total_cents || 0), 0)

  let manifest = []
  if (paidOrders.length) {
    const orderIds = paidOrders.map(o => o.id)
    const { data: items } = await supabase
      .from('order_items')
      .select('rider_first_name, rider_last_name, rider_phone, stop_index, ticket_types(name)')
      .in('order_id', orderIds)
    manifest = items || []
  }

  return (
    <main style={pageStyle}>
      <a href="/bookings" style={{ color: '#d4a333', fontSize: 13, textDecoration: 'none' }}>← Bookings</a>
      <h1 style={h1}>{event.name}</h1>
      <p style={subtle}>
        {event.event_date}{event.pickup_time ? ` · ${event.pickup_time}` : ''} · status: {event.status}
      </p>

      <div style={statsGrid}>
        <Stat label="Tickets sold" value={ticketCount} />
        <Stat label="Revenue" value={`$${(revenue / 100).toFixed(2)}`} />
        <Stat label="Capacity" value={event.capacity || '—'} />
      </div>

      <h2 style={h2}>Ticket types</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {(ticketTypes || []).map(t => (
          <div key={t.id} style={{ ...card, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#9c9ca3' }}>
                Stop {t.stop_index ?? '—'} · {t.active ? 'active' : 'inactive'}
              </div>
            </div>
            <div style={{ color: '#d4a333', fontWeight: 600 }}>${(t.price_cents / 100).toFixed(2)}</div>
          </div>
        ))}
        {(!ticketTypes || ticketTypes.length === 0) && (
          <div style={card}>No ticket types yet. Insert rows in <code>ticket_types</code> for this event.</div>
        )}
      </div>

      <h2 style={h2}>Manifest ({manifest.length})</h2>
      <div style={{ display: 'grid', gap: 6 }}>
        {manifest.map((m, i) => (
          <div key={i} style={{ ...card, padding: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>
              <strong>{m.rider_first_name} {m.rider_last_name}</strong>
              {m.rider_phone && <span style={{ color: '#9c9ca3' }}> · {m.rider_phone}</span>}
            </span>
            <span style={{ color: '#d4a333' }}>{m.ticket_types?.name || '—'}</span>
          </div>
        ))}
        {manifest.length === 0 && <div style={card}>No paid riders yet.</div>}
      </div>
    </main>
  )
}

function Stat({ label, value }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: '#9c9ca3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#d4a333' }}>{value}</div>
    </div>
  )
}

const pageStyle = { maxWidth: 900, margin: '0 auto', padding: '20px 16px', color: '#fff', minHeight: '100vh' }
const h1 = { fontSize: 26, color: '#fff', margin: '8px 0 4px' }
const h2 = { fontSize: 16, color: '#d4a333', margin: '24px 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }
const subtle = { color: '#9c9ca3', fontSize: 13, margin: '0 0 18px' }
const card = { padding: 14, background: '#15151a', border: '1px solid #2a2a31', borderRadius: 12 }
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '0 0 8px' }
