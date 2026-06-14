import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '../../_components/StatCard'
import DataTable from '../../_components/DataTable'

export const metadata = { title: 'Ridership — The Loop' }
export const dynamic = 'force-dynamic'

// Founder/test bookings (native, $0, internal names) are flagged out so the
// per-bar counts reflect real riders. Mirrors scripts/may-perbar-db.js.
const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']

// Map a ticket type name ("Stop 1: Angry Ginger - Pickup …") to its bar.
function parseBar(name) {
  if (!name) return 'Unknown'
  let t = String(name).split(/\s*[-–—]\s*Pick/i)[0].trim()
  t = t.replace(/^Stop\s*\d+\s*:\s*/i, '')
  if (/^walk/i.test(t)) return 'Walk-on'
  return t.replace(/^HideAway/i, 'Hideaway').replace(/\s+(Lounge|Pub|Tavern)$/i, '').replace(/^The\s+/i, '').trim() || 'Unknown'
}

function money(cents) {
  return `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function RidershipPage() {
  const supabase = supabaseAdmin()

  const { data: items } = await supabase
    .from('order_items')
    .select('unit_price_cents, tt_ticket_id, ticket_types ( name ), orders!inner ( status, buyer_name, total_cents )')
    .is('voided_at', null)
    .eq('orders.status', 'paid')
    .limit(20000)

  // bar -> { riders, revenue, tt, native }
  const tally = new Map()
  for (const it of items || []) {
    const isNative = !it.tt_ticket_id
    const isFounder = isNative
      && FOUNDERS.includes((it.orders?.buyer_name || '').trim().toLowerCase())
      && (it.orders?.total_cents || 0) === 0
    if (isFounder) continue
    const bar = parseBar(it.ticket_types?.name)
    const row = tally.get(bar) || { riders: 0, revenue: 0, tt: 0, native: 0 }
    row.riders += 1
    row.revenue += it.unit_price_cents || 0
    if (isNative) row.native += 1
    else row.tt += 1
    tally.set(bar, row)
  }

  // Waitlist demand per bar (sold-out overflow we couldn't serve).
  const { data: waitlist } = await supabase
    .from('event_waitlist')
    .select('party_size, ticket_types ( name )')
    .limit(5000)
  const waitByBar = new Map()
  let waitlistTotal = 0
  for (const w of waitlist || []) {
    const bar = w.ticket_types?.name ? parseBar(w.ticket_types.name) : 'Unspecified'
    const n = w.party_size || 1
    waitByBar.set(bar, (waitByBar.get(bar) || 0) + n)
    waitlistTotal += n
  }

  const barNames = new Set([...tally.keys(), ...waitByBar.keys()])
  const rows = [...barNames]
    .map(bar => {
      const t = tally.get(bar) || { riders: 0, revenue: 0, tt: 0, native: 0 }
      return {
        key: bar,
        bar,
        riders: t.riders,
        revenue: t.revenue,
        split: `${t.tt} TT / ${t.native} native`,
        waitlist: waitByBar.get(bar) || 0,
      }
    })
    .sort((a, b) => b.riders - a.riders)

  const totalRiders = rows.reduce((s, r) => s + r.riders, 0)
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)

  const columns = [
    { key: 'bar', header: 'Bar', primary: true },
    { key: 'riders', header: 'Riders', mono: true, align: 'right' },
    { key: 'revenue', header: 'Ticket rev', mono: true, align: 'right', render: r => money(r.revenue) },
    { key: 'split', header: 'TT / native', hideOnMobile: true, mono: true, align: 'right' },
    {
      key: 'waitlist', header: 'Waitlist', mono: true, align: 'right',
      render: r => r.waitlist > 0
        ? <span style={{ color: '#d4a333', fontWeight: 700 }}>{r.waitlist}</span>
        : <span style={{ color: '#6f6f76' }}>0</span>,
    },
  ]

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership/income" style={backLink}>← Income</Link>

        <div style={headerRow}>
          <h1 style={h1Style}>Ridership by bar</h1>
        </div>

        <p style={{ color: '#9c9ca3', fontSize: 13, margin: '0 0 18px', maxWidth: 640, fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }}>
          Riders delivered to each partner bar (all paid loops, founder tests excluded) plus
          the sold-out waitlist demand you couldn&rsquo;t serve — the renewal/expansion signal.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 22 }}>
          <StatCard label="Total riders" value={totalRiders.toLocaleString('en-US')} tone="gold" />
          <StatCard label="Ticket revenue" value={money(totalRevenue)} tone="ok" />
          <StatCard label="Waitlist demand" value={waitlistTotal} tone={waitlistTotal ? 'gold' : 'dim'} hint="Riders we couldn’t seat" />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => r.key}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>No paid rides recorded yet.</div>}
        />
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
  gap: 12, flexWrap: 'wrap', marginBottom: 18,
}
const h1Style = {
  color: '#e8e8ea', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0,
}
