import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'

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

export default async function IncomePage() {
  const supabase = supabaseAdmin()
  const now = new Date()
  const mtd = startOfMonth(now).toISOString()
  const qtd = startOfQuarter(now).toISOString()
  const ytd = startOfYear(now).toISOString()

  const fetchSums = async (since) => {
    const [orders, sponsorPay, barPay] = await Promise.all([
      supabase.from('orders')
        .select('total_cents')
        .eq('status', 'paid')
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
          margin: '0 0 22px 0',
          textShadow: '0 0 14px rgba(212,163,51,0.45)',
        }}>
          Income
        </h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 28,
        }} className="leadership-income-grid">
          {periods.map(p => {
            const total = p.sums.tickets + p.sums.sponsors + p.sums.bars
            return (
              <div key={p.label} style={{
                background: 'linear-gradient(180deg, #121216, #0d0d10)',
                border: '1px solid #2a2a31',
                borderRadius: 8,
                padding: '14px 16px',
              }}>
                <div style={{ color: '#9c9ca3', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {p.label}
                </div>
                <div style={{
                  color: '#e8e8ea',
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  marginBottom: 10,
                }}>
                  {formatCents(total)}
                </div>
                <Stream label="Tickets"  cents={p.sums.tickets}  total={total} color="#3fb27f" />
                <Stream label="Sponsors" cents={p.sums.sponsors} total={total} color="#d4a333" />
                <Stream label="Bars"     cents={p.sums.bars}     total={total} color="#5a8de8" />
              </div>
            )
          })}
        </div>

        <h2 style={{
          color: '#e8e8ea',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          fontSize: 13,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          margin: '0 0 12px 0',
          borderBottom: '1px solid #2a2a31',
          paddingBottom: 6,
        }}>
          Recent Payments
        </h2>

        {feed.length === 0 ? (
          <div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>
            No payments recorded yet. <a href="/leadership/sponsors" style={{ color: '#d4a333' }}>Record your first one →</a>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a31' }}>
                <th style={th}>When</th>
                <th style={th}>Type</th>
                <th style={th}>Who</th>
                <th style={th}>Method</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {feed.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #2a2a31' }}>
                  <td style={td}>{new Date(row.when).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td style={td}>
                    <span style={{
                      background: typeColors[row.type].bg,
                      color: typeColors[row.type].fg,
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 4,
                    }}>{row.type}</span>
                  </td>
                  <td style={td}>{row.who}</td>
                  <td style={{ ...td, color: '#9c9ca3', textTransform: 'capitalize' }}>{row.method}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: "'Orbitron', system-ui, sans-serif", fontWeight: 700 }}>{formatCents(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <style>{`
          @media (max-width: 720px) {
            .leadership-income-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </main>
  )
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

const th = {
  textAlign: 'left',
  padding: '8px 6px',
  color: '#9c9ca3',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}
const td = {
  padding: '10px 6px',
  color: '#e8e8ea',
}
