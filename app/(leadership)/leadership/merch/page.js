import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '../../_components/StatCard'
import StatusBadge from '../../_components/StatusBadge'
import DataTable from '../../_components/DataTable'

export const metadata = { title: 'Merch orders — The Loop' }
export const dynamic = 'force-dynamic'

// The merch fulfillment queue.
//
// Checkout, the webhook and the storefront all shipped before this page did,
// which meant a paid merch order landed in `merch_orders` and then sat there:
// `fulfillment_status` and `tracking_number` existed in migration 046 with
// nothing on earth able to write them. Someone paid and nobody found out.
//
// So this page is a QUEUE, not a report. The top half is only orders that owe
// somebody something, each with the address and the items right there so you
// can pack it without opening Stripe or Supabase. Everything already handled
// drops into the history table underneath and stops asking for attention.
//
// The shipping-method split is the thing to keep: "Grab it on the shuttle" is
// not a cheaper shipping option, it's a different job — nothing to pack, but
// somebody has to physically carry it out on a Friday night.

const money = cents => `$${((cents || 0) / 100).toFixed(2)}`

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return '—' }
}

function isShuttle(order) {
  return /shuttle/i.test(order?.shipping_method || '')
}

function addressLines(order) {
  const a = order?.shipping_address
  if (!a) return []
  return [
    order.buyer_name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(', '),
  ].filter(Boolean)
}

async function markFulfilled(orderId, formData) {
  'use server'
  const tracking = (formData.get('tracking') || '').toString().trim() || null
  const supabase = supabaseAdmin()
  await supabase
    .from('merch_orders')
    .update({
      fulfillment_status: 'fulfilled',
      status: 'fulfilled',
      tracking_number: tracking,
      fulfilled_at: new Date().toISOString(),
    })
    .eq('id', orderId)
  revalidatePath('/leadership/merch')
}

async function reopen(orderId) {
  'use server'
  const supabase = supabaseAdmin()
  await supabase
    .from('merch_orders')
    .update({
      fulfillment_status: 'unfulfilled',
      status: 'paid',
      tracking_number: null,
      fulfilled_at: null,
    })
    .eq('id', orderId)
  revalidatePath('/leadership/merch')
}

export default async function MerchOrdersPage() {
  const supabase = supabaseAdmin()

  // 'pending' rows are abandoned carts — a Checkout session created and never
  // paid. They're noise here, not work, so they never reach the page.
  const { data: orders } = await supabase
    .from('merch_orders')
    .select('id, status, fulfillment_status, tracking_number, buyer_name, buyer_email, buyer_phone, shipping_address, shipping_method, subtotal_cents, shipping_cents, total_cents, paid_at, fulfilled_at, refunded_at, merch_order_items (name, unit_price_cents, quantity)')
    .in('status', ['paid', 'fulfilled', 'refunded'])
    .order('paid_at', { ascending: false })
    .limit(500)

  const all = orders || []
  const queue = all.filter(o => o.status === 'paid' && o.fulfillment_status !== 'fulfilled')
  const queueIds = new Set(queue.map(o => o.id))
  const done = all.filter(o => !queueIds.has(o.id))

  const toShip = queue.filter(o => !isShuttle(o))
  const toHand = queue.filter(o => isShuttle(o))
  const revenue = all
    .filter(o => o.status !== 'refunded')
    .reduce((s, o) => s + (o.total_cents ?? o.subtotal_cents ?? 0), 0)
  const refunded = all.filter(o => o.status === 'refunded').length

  const columns = [
    { key: 'buyer', header: 'Buyer', primary: true },
    { key: 'paid', header: 'Paid', render: r => fmtDate(r.paid_at) },
    { key: 'items', header: 'Items', render: r => r.itemLabel },
    {
      key: 'method', header: 'How',
      render: r => r.shipping_method
        ? <StatusBadge label={isShuttle(r) ? 'shuttle' : 'shipped'} tone={isShuttle(r) ? 'gold' : 'blue'} />
        : '—',
    },
    { key: 'total', header: 'Total', mono: true, render: r => money(r.total_cents ?? r.subtotal_cents) },
    {
      key: 'status', header: 'Status',
      render: r => r.status === 'refunded'
        ? <StatusBadge label="refunded" tone="red" />
        : <StatusBadge label="fulfilled" tone="green" />,
    },
    {
      key: 'tracking', header: 'Tracking', mono: true,
      render: r => r.tracking_number || (isShuttle(r) ? 'handed over' : '—'),
    },
    {
      key: 'undo', header: '',
      render: r => r.status === 'refunded' ? null : (
        <form action={reopen.bind(null, r.id)}>
          <button type="submit" style={undoBtn}>Undo</button>
        </form>
      ),
    },
  ]

  const rows = done.map(o => ({
    ...o,
    key: o.id,
    buyer: o.buyer_name || o.buyer_email || '(unknown)',
    itemLabel: (o.merch_order_items || [])
      .map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
      .join(', ') || '—',
  }))

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership" style={backLink}>← Scoreboard</Link>

        <div style={headerRow}>
          <h1 style={h1Style}>Merch orders</h1>
        </div>

        <p style={{ color: '#6e6154', fontSize: 13, lineHeight: 1.5, margin: '0 0 18px', maxWidth: 640 }}>
          Paid orders waiting on us. Ship the mail ones, carry the shuttle ones out on Friday,
          then mark them done so they stop showing up here.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 26 }}>
          <StatCard label="To ship" value={toShip.length} tone={toShip.length ? 'gold' : 'dim'} />
          <StatCard label="To hand over" value={toHand.length} tone={toHand.length ? 'gold' : 'dim'} />
          <StatCard label="Merch revenue" value={money(revenue)} />
          <StatCard label="Refunded" value={refunded} tone={refunded ? 'err' : 'dim'} />
        </div>

        {queue.length === 0 ? (
          <div style={emptyQueue}>
            Nothing waiting. Every paid order has been shipped or handed over.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginBottom: 34 }}>
            {queue.map(o => {
              const shuttle = isShuttle(o)
              const lines = addressLines(o)
              return (
                <div key={o.id} style={card}>
                  <div style={cardTop}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#17130f', fontSize: 16, fontWeight: 700 }}>
                          {o.buyer_name || o.buyer_email || '(unknown buyer)'}
                        </span>
                        <StatusBadge
                          label={shuttle ? 'on the shuttle' : 'ship it'}
                          tone={shuttle ? 'gold' : 'blue'}
                        />
                      </div>
                      <div style={{ color: '#7d7060', fontSize: 12, marginTop: 4 }}>
                        Paid {fmtDate(o.paid_at)}
                        {o.buyer_email ? ` · ${o.buyer_email}` : ''}
                        {o.buyer_phone ? ` · ${o.buyer_phone}` : ''}
                      </div>
                    </div>
                    <div style={{ color: '#17130f', fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {money(o.total_cents ?? o.subtotal_cents)}
                    </div>
                  </div>

                  <div style={cardCols}>
                    <div>
                      <div style={cardLabel}>Pack</div>
                      {(o.merch_order_items || []).map((i, n) => (
                        <div key={n} style={{ color: '#17130f', fontSize: 14.5, padding: '3px 0' }}>
                          {i.name}
                          {i.quantity > 1 && <span style={{ color: '#6e6154' }}> × {i.quantity}</span>}
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={cardLabel}>{shuttle ? 'Handover' : 'Ship to'}</div>
                      {shuttle ? (
                        <div style={{ color: '#17130f', fontSize: 14, lineHeight: 1.55 }}>
                          Riding with us. Put it on the bus with their name on it.
                        </div>
                      ) : lines.length ? (
                        <div style={{ color: '#17130f', fontSize: 14, lineHeight: 1.55 }}>
                          {lines.map((l, n) => <div key={n}>{l}</div>)}
                        </div>
                      ) : (
                        <div style={{ color: '#b3311f', fontSize: 13.5, lineHeight: 1.55 }}>
                          No address on this order. Email them before shipping anything.
                        </div>
                      )}
                    </div>
                  </div>

                  <form action={markFulfilled.bind(null, o.id)} style={fulfillRow}>
                    {!shuttle && (
                      <input name="tracking" placeholder="Tracking number (optional)" style={trackingInput} />
                    )}
                    <button type="submit" style={fulfillBtn}>
                      {shuttle ? 'Handed over' : 'Mark shipped'}
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        )}

        <h2 style={h2Style}>Handled</h2>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => r.key}
          empty={<div style={{ color: '#6e6154', fontSize: 13, padding: '20px 0' }}>
            No completed merch orders yet.
          </div>}
        />
      </div>
    </main>
  )
}

const mainStyle = {
  minHeight: '100vh',
  background: '#faf5ea',
  color: '#17130f',
  padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
  paddingLeft: 'max(16px, env(safe-area-inset-left))',
  paddingRight: 'max(16px, env(safe-area-inset-right))',
  fontFamily: 'inherit',
}
const backLink = {
  color: '#6e6154', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
  textDecoration: 'none', display: 'inline-block', marginBottom: 18,
}
const headerRow = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
  gap: 12, flexWrap: 'wrap', marginBottom: 8,
}
const h1Style = {
  color: '#17130f', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0,
}
const h2Style = {
  color: '#6e6154', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
  fontWeight: 700, margin: '0 0 12px',
}
const card = {
  background: 'linear-gradient(180deg, #ffffff, #fdfaf3)',
  border: '1px solid #e8ddc8', borderRadius: 12, padding: '16px 18px',
}
const cardTop = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 12, paddingBottom: 14, borderBottom: '1px solid #e8ddc8',
}
const cardCols = {
  display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  padding: '14px 0',
}
const cardLabel = {
  color: '#7d7060', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  fontWeight: 700, marginBottom: 6,
}
const fulfillRow = {
  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
  paddingTop: 14, borderTop: '1px solid #e8ddc8',
}
const trackingInput = {
  flex: '1 1 200px', minWidth: 0, background: '#faf5ea', color: '#17130f',
  border: '1px solid #e8ddc8', borderRadius: 8, padding: '10px 12px',
  fontSize: 14, fontFamily: 'inherit',
}
const fulfillBtn = {
  background: '#d4a333', color: '#231903', border: 'none', borderRadius: 8,
  padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}
const undoBtn = {
  background: 'transparent', color: '#7d7060', border: '1px solid #e8ddc8',
  borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
  fontFamily: 'inherit',
}
const emptyQueue = {
  border: '1px dashed #e8ddc8', borderRadius: 12, padding: '26px 18px',
  color: '#7d7060', fontSize: 14, textAlign: 'center', marginBottom: 34,
}
