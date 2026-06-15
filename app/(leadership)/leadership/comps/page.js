import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '../../_components/StatCard'
import StatusBadge from '../../_components/StatusBadge'
import DataTable from '../../_components/DataTable'

export const metadata = { title: 'Free / comped rides — The Loop' }
export const dynamic = 'force-dynamic'

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return '—' }
}
function fmtEventDate(d) {
  if (!d) return '—'
  try {
    return new Date(`${d}T12:00:00-05:00`).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return d }
}
const money = cents => `$${((cents || 0) / 100).toFixed(0)}`

export default async function CompsPage() {
  const supabase = supabaseAdmin()

  // Paid orders carry their face value in total_cents; the Stripe webhook records
  // what was ACTUALLY collected (and any promo code) in metadata. A free ride is
  // a paid order that collected $0 — a 100%-off code. Orders booked before the
  // capture shipped only appear once the backfill has stamped their metadata.
  const { data: orders } = await supabase
    .from('orders')
    .select('id, buyer_name, buyer_email, party_size, total_cents, paid_at, metadata, events ( event_date, name )')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(1000)

  const all = orders || []
  const withCapture = all.filter(o => o.metadata && o.metadata.amount_collected_cents != null)
  const free = withCapture.filter(o => o.metadata.amount_collected_cents === 0)
  const discounted = withCapture.filter(o =>
    o.metadata.amount_collected_cents > 0 && (o.metadata.discount_cents || 0) > 0)
  const uncaptured = all.length - withCapture.length

  const freeRiders = free.reduce((s, o) => s + (o.party_size || 0), 0)
  const faceGivenAway = free.reduce((s, o) => s + (o.total_cents || 0), 0)

  const rows = [...free, ...discounted].map(o => {
    const m = o.metadata || {}
    const collected = m.amount_collected_cents ?? 0
    return {
      key: o.id,
      buyer: o.buyer_name || o.buyer_email || '(unknown)',
      event: o.events?.event_date || null,
      tickets: o.party_size || 0,
      code: m.promo_code || '—',
      face: o.total_cents || 0,
      collected,
      free: collected === 0,
    }
  })

  const columns = [
    { key: 'buyer', header: 'Buyer', primary: true },
    { key: 'event', header: 'Loop', render: r => fmtEventDate(r.event) },
    { key: 'tickets', header: 'Tickets', mono: true },
    { key: 'code', header: 'Code', render: r => r.code === '—' ? '—' : <StatusBadge label={r.code} tone="gold" /> },
    { key: 'face', header: 'Face value', mono: true, render: r => money(r.face) },
    {
      key: 'collected', header: 'Collected', mono: true,
      render: r => r.free
        ? <StatusBadge label="$0 — free" tone="red" />
        : <span style={{ color: '#3fb27f' }}>{money(r.collected)}</span>,
    },
  ]

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership" style={backLink}>← Scoreboard</Link>

        <div style={headerRow}>
          <h1 style={h1Style}>Free / comped rides</h1>
        </div>

        <p style={{ color: '#9c9ca3', fontSize: 13, lineHeight: 1.5, margin: '0 0 18px', maxWidth: 640 }}>
          Riders who used a 100%-off code rode free — these orders show a face value but
          collected $0, so they don&apos;t count as paid sales. Discounted (but still paid)
          orders are listed below them.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 22 }}>
          <StatCard label="Free orders" value={free.length} tone={free.length ? 'err' : 'dim'} />
          <StatCard label="Free riders" value={freeRiders} />
          <StatCard label="Face value given away" value={money(faceGivenAway)} mono />
          <StatCard label="Discounted (paid)" value={discounted.length} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => r.key}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>
            No comped or discounted orders captured yet.
          </div>}
        />

        {uncaptured > 0 && (
          <p style={{ color: '#6b6b72', fontSize: 12, marginTop: 16 }}>
            {uncaptured} older paid order{uncaptured === 1 ? '' : 's'} predate collected-amount
            capture and aren&apos;t classified here yet. Run the comp backfill to include them.
          </p>
        )}
      </div>
    </main>
  )
}

const mainStyle = {
  minHeight: '100vh',
  background: '#0a0a0b',
  color: '#e8e8ea',
  padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
  paddingLeft: 'max(16px, env(safe-area-inset-left))',
  paddingRight: 'max(16px, env(safe-area-inset-right))',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}
const backLink = {
  color: '#9c9ca3', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
  textDecoration: 'none', display: 'inline-block', marginBottom: 18,
}
const headerRow = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
  gap: 12, flexWrap: 'wrap', marginBottom: 8,
}
const h1Style = {
  color: '#e8e8ea', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0,
}
