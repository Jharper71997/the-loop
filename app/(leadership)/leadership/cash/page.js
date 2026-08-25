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
      background: '#faf5ea',
      color: '#17130f',
      padding: '24px 16px 48px',
      fontFamily: 'inherit',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <a href="/leadership/income" style={{
          color: '#6e6154',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 18,
        }}>
          ← Income
        </a>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <h1 style={{
            color: '#17130f',
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
            color: '#231903',
            fontFamily: 'inherit',
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
          background: 'linear-gradient(180deg, #ffffff, #fdfaf3)',
          border: '1px solid #e8ddc8',
          borderRadius: 8,
          padding: '20px 22px',
          marginBottom: 22,
        }}>
          <div style={{ color: '#6e6154', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
            Latest Balance
          </div>
          <div style={{
            color: latest ? '#17130f' : '#7d7060',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}>
            {latest ? formatCents(latest.balance_cents) : '—'}
          </div>
          {latest && (
            <div style={{ color: '#6e6154', fontSize: 11, marginTop: 8, letterSpacing: '0.04em' }}>
              {latest.account_name} · {new Date(latest.as_of).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {delta != null && (
                <>
                  {' · '}
                  <span style={{ color: delta >= 0 ? '#0f7a4e' : '#b3311f' }}>
                    {delta >= 0 ? '+' : ''}{formatCents(delta)} vs prior
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <h2 style={{
          color: '#17130f',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: '0 0 12px 0',
          borderBottom: '1px solid #e8ddc8',
          paddingBottom: 6,
        }}>
          History
        </h2>

        {(history || []).length === 0 ? (
          <div style={{ color: '#6e6154', fontSize: 13, padding: '20px 0' }}>
            No balance entries yet. <a href="/leadership/cash/new" style={{ color: '#8a5f0a' }}>Record the first one.</a>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8ddc8' }}>
                <th style={th}>Date</th>
                <th style={th}>Account</th>
                <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                <th style={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #e8ddc8' }}>
                  <td style={td}>{new Date(row.as_of).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td style={td}>{row.account_name}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontWeight: 700 }}>{formatCents(row.balance_cents)}</td>
                  <td style={{ ...td, color: '#6e6154' }}>{row.notes || ''}</td>
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
  color: '#6e6154',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}
const td = {
  padding: '10px 6px',
  color: '#17130f',
}
