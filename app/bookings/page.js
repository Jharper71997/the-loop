import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bookings — The Loop' }

export default async function BookingsAdmin() {
  const supabase = supabaseAdmin()
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, pickup_time, status, capacity')
    .order('event_date', { ascending: false })

  const eventIds = (events || []).map(e => e.id)
  let salesByEvent = new Map()
  if (eventIds.length) {
    const { data: orders } = await supabase
      .from('orders')
      .select('event_id, status, total_cents, party_size')
      .in('event_id', eventIds)
      .eq('status', 'paid')
    for (const o of orders || []) {
      const cur = salesByEvent.get(o.event_id) || { tickets: 0, revenue: 0 }
      cur.tickets += o.party_size || 0
      cur.revenue += o.total_cents || 0
      salesByEvent.set(o.event_id, cur)
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={h1}>Bookings</h1>
      <p style={subtle}>
        Sales-side view of every event. Use the admin SQL or seed scripts to add new events + ticket types.
      </p>

      {(!events || events.length === 0) && (
        <div style={card}>No events yet. Create one in <code>events</code> + <code>ticket_types</code>.</div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {(events || []).map(ev => {
          const sales = salesByEvent.get(ev.id) || { tickets: 0, revenue: 0 }
          return (
            <a key={ev.id} href={`/bookings/${ev.id}`} style={{ ...card, textDecoration: 'none', color: '#fff', display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={accentSmall}>{ev.event_date}{ev.pickup_time ? ` · ${ev.pickup_time}` : ''}</div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{ev.name}</div>
                </div>
                <span style={statusPill(ev.status)}>{ev.status}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: '#bbb' }}>
                {sales.tickets} tickets · ${(sales.revenue / 100).toFixed(2)}
                {ev.capacity ? ` / cap ${ev.capacity}` : ''}
              </div>
            </a>
          )
        })}
      </div>
    </main>
  )
}

const pageStyle = { maxWidth: 900, margin: '0 auto', padding: '20px 16px', color: '#fff', minHeight: '100vh' }
const h1 = { fontSize: 26, color: '#d4a333', margin: '0 0 4px' }
const subtle = { color: '#9c9ca3', fontSize: 13, margin: '0 0 18px' }
const card = { padding: 14, background: '#15151a', border: '1px solid #2a2a31', borderRadius: 12 }
const accentSmall = { color: '#d4a333', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }
function statusPill(status) {
  const colors = { on_sale: '#10b981', sold_out: '#9c9ca3', cancelled: '#f87171', draft: '#facc15' }
  return {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 999,
    background: '#0a0a0b',
    border: `1px solid ${colors[status] || '#2a2a31'}`,
    color: colors[status] || '#bbb',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }
}
