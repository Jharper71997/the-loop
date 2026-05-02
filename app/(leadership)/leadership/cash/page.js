import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'

export const dynamic = 'force-dynamic'

export default async function CashPage() {
  const supabase = supabaseAdmin()
  const { data: history } = await supabase
    .from('bank_balances')
    .select('id, account_name, balance_cents, as_of, notes')
    .order('as_of', { ascending: false })
    .limit(20)

  const latest = history?.[0]
  const prior = history?.[1]
  const delta = latest && prior ? latest.balance_cents - prior.balance_cents : null

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
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

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <h1 style={{
            color: '#e8e8ea',
            fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            Cash Position
          </h1>
          <a href="/leadership/cash/new" style={{
            background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
            color: '#0a0a0b',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '10px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            boxShadow: '0 0 20px rgba(212,163,51,0.35)',
          }}>
            + New Balance
          </a>
        </div>

        <div style={{
          background: 'linear-gradient(180deg, #121216, #0d0d10)',
          border: '1px solid #2a2a31',
          borderRadius: 8,
          padding: '20px 22px',
          marginBottom: 22,
        }}>
          <div style={{ color: '#9c9ca3', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
            Latest Balance
          </div>
          <div style={{
            color: latest ? '#e8e8ea' : '#6f6f76',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}>
            {latest ? formatCents(latest.balance_cents) : '—'}
          </div>
          {latest && (
            <div style={{ color: '#9c9ca3', fontSize: 11, marginTop: 8, letterSpacing: '0.04em' }}>
              {latest.account_name} · {new Date(latest.as_of).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {delta != null && (
                <>
                  {' · '}
                  <span style={{ color: delta >= 0 ? '#3fb27f' : '#c44a3a' }}>
                    {delta >= 0 ? '+' : ''}{formatCents(delta)} vs prior
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <h2 style={{
          color: '#e8e8ea',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: '0 0 12px 0',
          borderBottom: '1px solid #2a2a31',
          paddingBottom: 6,
        }}>
          History
        </h2>

        {(history || []).length === 0 ? (
          <div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>
            No balance entries yet. <a href="/leadership/cash/new" style={{ color: '#d4a333' }}>Record the first one.</a>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a31' }}>
                <th style={th}>Date</th>
                <th style={th}>Account</th>
                <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                <th style={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #2a2a31' }}>
                  <td style={td}>{new Date(row.as_of).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td style={td}>{row.account_name}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontWeight: 700 }}>{formatCents(row.balance_cents)}</td>
                  <td style={{ ...td, color: '#9c9ca3' }}>{row.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
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
