import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Orders — The Loop' }

export default async function OrdersPage() {
  const supabase = supabaseAdmin()
  const { data: orders } = await supabase
    .from('orders')
    .select('id, buyer_name, buyer_phone, buyer_email, total_cents, status, party_size, paid_at, created_at, events(name, event_date)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <main style={pageStyle}>
      <h1 style={h1}>Orders</h1>
      <p style={subtle}>Native Brew Loop orders (Stripe Checkout). Legacy Ticket Tailor orders are tracked under Riders / Loops.</p>

      <div style={{ display: 'grid', gap: 8 }}>
        {(orders || []).map(o => (
          <div key={o.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{o.buyer_name || '(no name)'}</div>
                <div style={{ fontSize: 12, color: '#9c9ca3' }}>
                  {o.buyer_phone || o.buyer_email || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#d4a333', fontWeight: 700 }}>${(o.total_cents / 100).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: '#9c9ca3' }}>{o.party_size} ticket{o.party_size === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#bbb', display: 'flex', justifyContent: 'space-between' }}>
              <span>{o.events?.name || '—'} · {o.events?.event_date || '—'}</span>
              <span style={statusPill(o.status)}>{o.status}</span>
            </div>
          </div>
        ))}
        {(!orders || orders.length === 0) && <div style={card}>No native orders yet.</div>}
      </div>
    </main>
  )
}

function statusPill(status) {
  const colors = { paid: '#10b981', pending: '#facc15', refunded: '#9c9ca3', cancelled: '#f87171' }
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

const pageStyle = { maxWidth: 900, margin: '0 auto', padding: '20px 16px', color: '#fff', minHeight: '100vh' }
const h1 = { fontSize: 26, color: '#d4a333', margin: '0 0 4px' }
const subtle = { color: '#9c9ca3', fontSize: 13, margin: '0 0 18px' }
const card = { padding: 14, background: '#15151a', border: '1px solid #2a2a31', borderRadius: 12 }
