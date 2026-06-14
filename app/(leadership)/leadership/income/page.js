import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'
import { serverNow } from '@/lib/serverNow'
import LiveStamp from '../../_components/LiveStamp'
import DataTable from '../../_components/DataTable'
import StatCard from '../../_components/StatCard'
import StatusBadge from '../../_components/StatusBadge'

export const dynamic = 'force-dynamic'

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function startOfQuarter(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}
function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1)
}
function billingDateInMonth(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}
// Given a billing day-of-month (or null) + whether this cycle is paid,
// return the JS Date for the next time payment is due.
// If unpaid, returns this month's billing day (may be in the past = overdue).
// If paid, returns next month's billing day.
function computeNextDueDate(billingDay, paidThisCycle, today = new Date()) {
  if (billingDay == null) {
    const m = paidThisCycle ? today.getMonth() + 1 : today.getMonth()
    return billingDateInMonth(today.getFullYear(), m, 31)
  }
  const m = paidThisCycle ? today.getMonth() + 1 : today.getMonth()
  return billingDateInMonth(today.getFullYear(), m, billingDay)
}

export default async function IncomePage() {
  const supabase = supabaseAdmin()
  const renderedAt = await serverNow()
  const now = new Date()
  const mtd = startOfMonth(now).toISOString()
  const qtd = startOfQuarter(now).toISOString()
  const ytd = startOfYear(now).toISOString()

  const fetchSums = async (since) => {
    const [orders, sponsorPay, barPay] = await Promise.all([
      supabase.from('orders')
        .select('total_cents')
        .eq('status', 'paid')
        .is('refunded_at', null)
        .not('stripe_checkout_session_id', 'is', null)
        .gte('paid_at', since),
      supabase.from('sponsor_payments')
        .select('amount_cents')
        .gte('paid_at', since),
      supabase.from('bar_payments')
        .select('amount_cents')
        .gte('paid_at', since),
    ])
    const sum = (rows) => (rows?.data || []).reduce((s, r) => s + (r.amount_cents ?? r.total_cents ?? 0), 0)
    return {
      tickets: sum(orders),
      sponsors: sum(sponsorPay),
      bars: sum(barPay),
    }
  }

  const [mtdSums, qtdSums, ytdSums] = await Promise.all([
    fetchSums(mtd),
    fetchSums(qtd),
    fetchSums(ytd),
  ])

  // Upcoming payments: each active sponsor + bar with a monthly fee, with
  // their actual next due date (from payment_due_day) and whether the
  // current cycle is already paid.
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [{ data: sponsorsList }, { data: barsList }, { data: monthSponsorPayments }, { data: monthBarPayments }] = await Promise.all([
    supabase.from('sponsors').select('id, name, amount_committed, status, payment_due_day').in('status', ['committed', 'paid']),
    supabase.from('bars').select('slug, name, monthly_fee_cents, status, payment_due_day').eq('status', 'active'),
    supabase.from('sponsor_payments').select('sponsor_id, amount_cents, paid_for_period, paid_at').gte('paid_at', mtd),
    supabase.from('bar_payments').select('bar_slug, amount_cents, paid_for_period, paid_at').gte('paid_at', mtd),
  ])

  const sponsorPaidMap = new Map()
  for (const p of (monthSponsorPayments || [])) {
    const inMonth = p.paid_for_period ? p.paid_for_period.startsWith(monthStr) : true
    if (inMonth) sponsorPaidMap.set(p.sponsor_id, (sponsorPaidMap.get(p.sponsor_id) || 0) + p.amount_cents)
  }
  const barPaidMap = new Map()
  for (const p of (monthBarPayments || [])) {
    const inMonth = p.paid_for_period ? p.paid_for_period.startsWith(monthStr) : true
    if (inMonth) barPaidMap.set(p.bar_slug, (barPaidMap.get(p.bar_slug) || 0) + p.amount_cents)
  }

  const dayMs = 24 * 60 * 60 * 1000
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const dueRows = []
  for (const s of (sponsorsList || [])) {
    const monthlyCents = Math.round(Number(s.amount_committed || 0) * 100)
    if (!monthlyCents) continue
    const paid = sponsorPaidMap.get(s.id) || 0
    const paidThisCycle = paid >= monthlyCents
    const dueDate = computeNextDueDate(s.payment_due_day, paidThisCycle, now)
    const owed = Math.max(0, monthlyCents - paid)
    const daysUntil = Math.round((dueDate.getTime() - today0.getTime()) / dayMs)
    dueRows.push({
      type: 'sponsor',
      who: s.name,
      monthlyCents,
      owed,
      paidThisCycle,
      dueDate,
      daysUntil,
      hasBillingDay: s.payment_due_day != null,
      href: `/leadership/sponsors/${s.id}`,
    })
  }
  for (const b of (barsList || [])) {
    if (!b.monthly_fee_cents) continue
    const paid = barPaidMap.get(b.slug) || 0
    const paidThisCycle = paid >= b.monthly_fee_cents
    const dueDate = computeNextDueDate(b.payment_due_day, paidThisCycle, now)
    const owed = Math.max(0, b.monthly_fee_cents - paid)
    const daysUntil = Math.round((dueDate.getTime() - today0.getTime()) / dayMs)
    dueRows.push({
      type: 'bar',
      who: b.name,
      monthlyCents: b.monthly_fee_cents,
      owed,
      paidThisCycle,
      dueDate,
      daysUntil,
      hasBillingDay: b.payment_due_day != null,
      href: `/leadership/bars/${b.slug}`,
    })
  }
  // Show overdue + currently-owed first (sorted by date asc), then upcoming.
  dueRows.sort((a, b) => {
    if (a.paidThisCycle !== b.paidThisCycle) return a.paidThisCycle ? 1 : -1
    return a.dueDate.getTime() - b.dueDate.getTime()
  })
  const totalOutstanding = dueRows.reduce((s, r) => s + r.owed, 0)

  // Recent payments combined feed
  const { data: recentSponsor } = await supabase
    .from('sponsor_payments')
    .select('id, amount_cents, paid_at, method, sponsors(name)')
    .order('paid_at', { ascending: false })
    .limit(10)
  const { data: recentBar } = await supabase
    .from('bar_payments')
    .select('id, amount_cents, paid_at, method, bars(name)')
    .order('paid_at', { ascending: false })
    .limit(10)
  const { data: recentTicket } = await supabase
    .from('orders')
    .select('id, total_cents, paid_at, buyer_name')
    .eq('status', 'paid')
    .is('refunded_at', null)
    .not('stripe_checkout_session_id', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(10)

  const feed = [
    ...(recentSponsor || []).map(p => ({
      type: 'sponsor', when: p.paid_at, amount: p.amount_cents,
      who: p.sponsors?.name || 'Sponsor', method: p.method,
    })),
    ...(recentBar || []).map(p => ({
      type: 'bar', when: p.paid_at, amount: p.amount_cents,
      who: p.bars?.name || 'Bar', method: p.method,
    })),
    ...(recentTicket || []).map(o => ({
      type: 'ticket', when: o.paid_at, amount: o.total_cents,
      who: o.buyer_name || 'Anonymous', method: 'stripe',
    })),
  ].sort((a, b) => new Date(b.when) - new Date(a.when)).slice(0, 20)

  const periods = [
    { label: 'MTD', sums: mtdSums },
    { label: 'QTD', sums: qtdSums },
    { label: 'YTD', sums: ytdSums },
  ]

  const dueColumns = [
    {
      key: 'who', header: 'Who', primary: true,
      render: r => (
        <>
          <Link href={r.href} style={{ color: '#e8e8ea', textDecoration: 'none', fontWeight: 600 }}>{r.who}</Link>
          {!r.hasBillingDay && <div style={{ fontSize: 10, color: '#6f6f76', marginTop: 2 }}>No billing day set</div>}
        </>
      ),
    },
    {
      key: 'type', header: 'Type',
      render: r => <StatusBadge label={r.type} bg={typeColors[r.type].bg} fg={typeColors[r.type].fg} />,
    },
    {
      key: 'due', header: 'Due By', mono: true,
      render: r => {
        const overdue = !r.paidThisCycle && r.daysUntil < 0
        const urgent = !r.paidThisCycle && r.daysUntil >= 0 && r.daysUntil <= 5
        const dateColor = overdue ? '#c44a3a' : urgent ? '#d4a333' : '#e8e8ea'
        return (
          <span style={{ color: dateColor, fontWeight: overdue || urgent ? 700 : 500 }}>
            {r.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )
      },
    },
    { key: 'status', header: 'Status', render: r => dueStatusEl(r) },
    {
      key: 'amount', header: 'Amount', align: 'right', mono: true,
      render: r => (
        <span style={{ fontWeight: 700, color: r.paidThisCycle ? '#9c9ca3' : '#d4a333' }}>
          {formatCents(r.paidThisCycle ? r.monthlyCents : r.owed)}
        </span>
      ),
    },
  ]

  const feedColumns = [
    {
      key: 'when', header: 'When', primary: true,
      render: r => new Date(r.when).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    },
    {
      key: 'type', header: 'Type',
      render: r => <StatusBadge label={r.type} bg={typeColors[r.type].bg} fg={typeColors[r.type].fg} />,
    },
    { key: 'who', header: 'Who', render: r => r.who },
    { key: 'method', header: 'Method', render: r => <span style={{ color: '#9c9ca3', textTransform: 'capitalize' }}>{r.method}</span> },
    {
      key: 'amount', header: 'Amount', align: 'right', mono: true,
      render: r => <span style={{ fontWeight: 700 }}>{formatCents(r.amount)}</span>,
    },
  ]

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <a href="/leadership" style={{
          color: '#9c9ca3',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 18,
        }}>
          ← Scoreboard
        </a>

        <h1 style={{
          color: '#e8e8ea',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          margin: '0 0 4px 0',
        }}>
          Income
        </h1>
        <LiveStamp renderedAt={renderedAt} style={{ marginBottom: 22 }} />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 28,
        }} className="leadership-income-grid">
          {periods.map(p => {
            const total = p.sums.tickets + p.sums.sponsors + p.sums.bars
            return (
              <StatCard key={p.label} label={p.label} value={formatCents(total)}>
                <div style={{ marginTop: 10 }}>
                  <Stream label="Tickets"  cents={p.sums.tickets}  total={total} color="#3fb27f" />
                  <Stream label="Sponsors" cents={p.sums.sponsors} total={total} color="#d4a333" />
                  <Stream label="Bars"     cents={p.sums.bars}     total={total} color="#5a8de8" />
                </div>
              </StatCard>
            )
          })}
        </div>

        <h2 style={sectionHeading}>
          <span>Sponsor &amp; Bar Payments — Next Due</span>
          {totalOutstanding > 0 && (
            <span style={{ color: '#d4a333', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'none', fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
              {formatCents(totalOutstanding)} outstanding
            </span>
          )}
        </h2>

        <DataTable
          columns={dueColumns}
          rows={dueRows}
          rowKey={(r, i) => i}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '12px 0 24px' }}>No active sponsors or bars with a monthly fee yet.</div>}
        />

        <h2 style={sectionHeading}>Recent Payments</h2>

        <DataTable
          columns={feedColumns}
          rows={feed}
          rowKey={(r, i) => i}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>No payments recorded yet. <Link href="/leadership/sponsors" style={{ color: '#d4a333' }}>Record your first one →</Link></div>}
        />

        <style>{`
          @media (max-width: 720px) {
            .leadership-income-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </main>
  )
}

function dueStatusEl(row) {
  const overdue = !row.paidThisCycle && row.daysUntil < 0
  const urgent  = !row.paidThisCycle && row.daysUntil >= 0 && row.daysUntil <= 5
  if (row.paidThisCycle) {
    return <span style={{ color: '#3fb27f', fontSize: 11 }}>✓ Paid · next cycle</span>
  }
  if (overdue) {
    return <span style={{ color: '#c44a3a', fontSize: 11, fontWeight: 600 }}>Overdue {-row.daysUntil}d</span>
  }
  if (row.daysUntil === 0) {
    return <span style={{ color: '#d4a333', fontSize: 11, fontWeight: 600 }}>Due today</span>
  }
  return <span style={{ color: urgent ? '#d4a333' : '#9c9ca3', fontSize: 11 }}>In {row.daysUntil} day{row.daysUntil === 1 ? '' : 's'}</span>
}

function Stream({ label, cents, total, color }) {
  const pct = total > 0 ? (cents / total) * 100 : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
        <span style={{ color: '#9c9ca3' }}>{label}</span>
        <span style={{ color: '#e8e8ea' }}>{formatCents(cents)}</span>
      </div>
      <div style={{ height: 4, background: '#2a2a31', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

const typeColors = {
  ticket:  { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  sponsor: { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  bar:     { bg: 'rgba(90,141,232,0.15)',  fg: '#5a8de8' },
}

const sectionHeading = {
  color: '#e8e8ea',
  fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  margin: '0 0 12px 0',
  borderBottom: '1px solid #2a2a31',
  paddingBottom: 6,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 12,
  flexWrap: 'wrap',
}
