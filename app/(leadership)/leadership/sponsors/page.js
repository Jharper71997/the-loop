import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect:  { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  committed: { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  paid:      { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
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

export default async function SponsorsPage() {
  const supabase = supabaseAdmin()
  const { startISO, endISO, monthStr } = currentMonthBounds()

  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('id, name, contact, tier, amount_committed, amount_paid, status')
    .order('status')
    .order('name')

  const { data: payments } = await supabase
    .from('sponsor_payments')
    .select('sponsor_id, paid_at, paid_for_period, amount_cents')
    .order('paid_at', { ascending: false })
    .limit(500)

  const lastPaidBy = new Map()
  const paidThisMonth = new Map()
  for (const p of (payments || [])) {
    if (!lastPaidBy.has(p.sponsor_id)) lastPaidBy.set(p.sponsor_id, p)
    const inMonth = p.paid_for_period
      ? p.paid_for_period.startsWith(monthStr)
      : (p.paid_at >= startISO && p.paid_at < endISO)
    if (inMonth) {
      paidThisMonth.set(p.sponsor_id, (paidThisMonth.get(p.sponsor_id) || 0) + p.amount_cents)
    }
  }

  // Monthly expected = amount_committed for active sponsors (committed/paid).
  // Per Asana memory: amount_committed represents the monthly fee.
  let totalExpected = 0
  let totalPaid = 0
  let totalOwed = 0
  let countOwed = 0
  for (const s of sponsors || []) {
    if (s.status !== 'committed' && s.status !== 'paid') continue
    const monthlyCents = Math.round(Number(s.amount_committed || 0) * 100)
    if (!monthlyCents) continue
    totalExpected += monthlyCents
    const paid = paidThisMonth.get(s.id) || 0
    totalPaid += paid
    const owed = Math.max(0, monthlyCents - paid)
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

        <h1 style={{
          color: '#d4a333',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          fontSize: 22,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          margin: '0 0 18px 0',
          textShadow: '0 0 14px rgba(212,163,51,0.45)',
        }}>
          Sponsors
        </h1>

        <OutstandingBanner
          period={new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          expected={totalExpected}
          paid={totalPaid}
          owed={totalOwed}
          countOwed={countOwed}
        />

        {(sponsors || []).length === 0 ? (
          <div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>
            No sponsors yet. Add via Asana Lead Mgmt; sponsor records get inserted as they convert.
          </div>
        ) : (
          <div style={{
            background: 'linear-gradient(180deg, #121216, #0d0d10)',
            border: '1px solid #2a2a31',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a31', background: '#0d0d10' }}>
                  <th style={th}>Sponsor</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Monthly</th>
                  <th style={th}>This Month</th>
                  <th style={th}>Last Payment</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map(s => {
                  const lastP = lastPaidBy.get(s.id)
                  const sc = STATUS_COLORS[s.status] || STATUS_COLORS.prospect
                  const monthlyCents = Math.round(Number(s.amount_committed || 0) * 100)
                  const paid = paidThisMonth.get(s.id) || 0
                  const isActive = s.status === 'committed' || s.status === 'paid'
                  const owed = isActive && monthlyCents
                    ? Math.max(0, monthlyCents - paid)
                    : 0
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #2a2a31' }}>
                      <td style={td}>
                        <div style={{ fontWeight: 700 }}>{s.name}</div>
                        {s.tier && <div style={{ fontSize: 10, color: '#9c9ca3', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>{s.tier}</div>}
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
                        }}>{s.status}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                        {monthlyCents > 0 ? formatCents(monthlyCents) : '—'}
                      </td>
                      <td style={td}>
                        <ThisMonthCell paid={paid} owed={owed} active={isActive} fee={monthlyCents} />
                      </td>
                      <td style={{ ...td, color: '#9c9ca3' }}>
                        {lastP ? (
                          <>
                            {formatCents(lastP.amount_cents)} · {new Date(lastP.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <a href={`/leadership/sponsors/${s.id}/payments/new`} style={{
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
        )}
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
          {period} · Sponsors Outstanding
        </div>
        <div style={{ fontFamily: "'Orbitron', system-ui, sans-serif", fontSize: 22, fontWeight: 800, color }}>
          {formatCents(owed)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: '#9c9ca3', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>
          Paid / Expected
        </div>
        <div style={{ fontFamily: "'Orbitron', system-ui, sans-serif", fontSize: 16, fontWeight: 700 }}>
          {formatCents(paid)} / {formatCents(expected)} <span style={{ color: '#9c9ca3', fontWeight: 400 }}>({pct}%)</span>
        </div>
      </div>
      {countOwed > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#9c9ca3', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>
            Sponsors Behind
          </div>
          <div style={{ fontFamily: "'Orbitron', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#d4a333' }}>
            {countOwed}
          </div>
        </div>
      )}
    </div>
  )
}

function ThisMonthCell({ paid, owed, active, fee }) {
  if (!active || !fee) {
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
