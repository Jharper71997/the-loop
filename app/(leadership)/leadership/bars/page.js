import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect:  { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  active:    { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  paused:    { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  inactive:  { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
}

function currentMonthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    monthStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  }
}

export default async function BarsPage() {
  const supabase = supabaseAdmin()
  const { startISO, endISO, monthStr } = currentMonthBounds()

  const { data: bars } = await supabase
    .from('bars')
    .select('slug, name, status, monthly_fee_cents, payment_method, contact_name')
    .order('status')
    .order('name')

  // All payments (last 12 months for the "last paid" column)
  const { data: payments } = await supabase
    .from('bar_payments')
    .select('bar_slug, paid_at, paid_for_period, amount_cents')
    .order('paid_at', { ascending: false })
    .limit(500)

  const lastPaidBy = new Map()
  const paidThisMonth = new Map()  // bar_slug → cents paid this month

  for (const p of (payments || [])) {
    if (!lastPaidBy.has(p.bar_slug)) lastPaidBy.set(p.bar_slug, p)
    // "Paid this month" = paid_for_period in current month, OR paid_at in current month if period not set
    const period = p.paid_for_period
    const inMonth = period
      ? period.startsWith(monthStr)
      : (p.paid_at >= startISO && p.paid_at < endISO)
    if (inMonth) {
      paidThisMonth.set(p.bar_slug, (paidThisMonth.get(p.bar_slug) || 0) + p.amount_cents)
    }
  }

  // Outstanding totals (active bars only)
  let totalExpected = 0
  let totalPaid = 0
  let totalOwed = 0
  let countOwed = 0
  for (const b of bars || []) {
    if (b.status !== 'active' || !b.monthly_fee_cents) continue
    totalExpected += b.monthly_fee_cents
    const paid = paidThisMonth.get(b.slug) || 0
    totalPaid += paid
    const owed = Math.max(0, b.monthly_fee_cents - paid)
    if (owed > 0) {
      totalOwed += owed
      countOwed += 1
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
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

        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}>
          <h1 style={{
            color: '#e8e8ea',
            fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            Bars
          </h1>
          <a href="/leadership/bars/new" style={{
            background: '#d4a333',
            color: '#0a0a0b',
            fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 6,
            textDecoration: 'none',
          }}>
            + Add bar
          </a>
        </div>

        <OutstandingBanner
          period={new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          expected={totalExpected}
          paid={totalPaid}
          owed={totalOwed}
          countOwed={countOwed}
        />

        <div style={{
          background: 'linear-gradient(180deg, #121216, #0d0d10)',
          border: '1px solid #2a2a31',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a31', background: '#0d0d10' }}>
                <th style={th}>Bar</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Monthly</th>
                <th style={th}>This Month</th>
                <th style={th}>Last Payment</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(bars || []).map(b => {
                const lastP = lastPaidBy.get(b.slug)
                const sc = STATUS_COLORS[b.status] || STATUS_COLORS.prospect
                const paid = paidThisMonth.get(b.slug) || 0
                const owed = b.status === 'active' && b.monthly_fee_cents
                  ? Math.max(0, b.monthly_fee_cents - paid)
                  : 0
                return (
                  <tr key={b.slug} style={{ borderBottom: '1px solid #2a2a31' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{b.name}</div>
                      {b.contact_name && <div style={{ fontSize: 10, color: '#9c9ca3', marginTop: 2 }}>{b.contact_name}</div>}
                    </td>
                    <td style={td}>
                      <span style={{
                        background: sc.bg,
                        color: sc.fg,
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}>{b.status}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
                      {b.monthly_fee_cents > 0 ? formatCents(b.monthly_fee_cents) : '—'}
                    </td>
                    <td style={td}>
                      <ThisMonthCell paid={paid} owed={owed} status={b.status} fee={b.monthly_fee_cents} />
                    </td>
                    <td style={{ ...td, color: '#9c9ca3' }}>
                      {lastP ? (
                        <>
                          {formatCents(lastP.amount_cents)} · {new Date(lastP.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <a href={`/leadership/bars/${b.slug}/payments/new`} style={{
                        color: '#d4a333',
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        textDecoration: 'none',
                        fontWeight: 700,
                      }}>+ Payment</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function OutstandingBanner({ period, expected, paid, owed, countOwed }) {
  if (expected === 0) return null
  const pct = expected > 0 ? Math.round((paid / expected) * 100) : 0
  const color = owed === 0 ? '#3fb27f' : '#d4a333'
  return (
    <div style={{
      background: 'linear-gradient(180deg, #121216, #0d0d10)',
      border: `1px solid ${owed === 0 ? 'rgba(63,178,127,0.4)' : 'rgba(212,163,51,0.4)'}`,
      borderRadius: 8,
      padding: '14px 18px',
      marginBottom: 18,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 24,
      alignItems: 'baseline',
    }}>
      <div>
        <div style={{ fontSize: 10, color: '#9c9ca3', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>
          {period} · Bars Outstanding
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 800, color }}>
          {formatCents(owed)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: '#9c9ca3', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>
          Paid / Expected
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 16, fontWeight: 700 }}>
          {formatCents(paid)} / {formatCents(expected)} <span style={{ color: '#9c9ca3', fontWeight: 400 }}>({pct}%)</span>
        </div>
      </div>
      {countOwed > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#9c9ca3', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>
            Bars Behind
          </div>
          <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: '#d4a333' }}>
            {countOwed}
          </div>
        </div>
      )}
    </div>
  )
}

function ThisMonthCell({ paid, owed, status, fee }) {
  if (status !== 'active' || !fee) {
    return <span style={{ color: '#6f6f76', fontSize: 11 }}>—</span>
  }
  if (owed === 0 && paid > 0) {
    return (
      <span style={{ color: '#3fb27f', fontSize: 11, letterSpacing: '0.04em' }}>
        ✓ Paid {formatCents(paid)}
      </span>
    )
  }
  if (owed > 0 && paid > 0) {
    return (
      <span style={{ color: '#d4a333', fontSize: 11, letterSpacing: '0.04em' }}>
        Partial · {formatCents(paid)} of {formatCents(fee)}
      </span>
    )
  }
  return (
    <span style={{ color: '#c44a3a', fontSize: 11, letterSpacing: '0.04em' }}>
      Owes {formatCents(owed)}
    </span>
  )
}

const th = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#9c9ca3',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}
const td = {
  padding: '12px',
  color: '#e8e8ea',
  verticalAlign: 'top',
}
