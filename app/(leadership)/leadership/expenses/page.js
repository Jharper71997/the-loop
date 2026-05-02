import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage({ searchParams }) {
  const sp = await searchParams
  const justImported = sp?.imported

  const supabase = supabaseAdmin()
  const { data: rows } = await supabase
    .from('expenses')
    .select('id, qb_account, qb_category, category, amount_cents, expense_date, notes, vendor')
    .order('expense_date', { ascending: false })
    .limit(200)

  // Group by month YYYY-MM for rendering
  const byMonth = new Map()
  for (const r of rows || []) {
    const month = (r.expense_date || '').slice(0, 7)
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month).push(r)
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
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 22,
        }}>
          <h1 style={{
            color: '#d4a333',
            fontFamily: "'Orbitron', system-ui, sans-serif",
            fontSize: 22,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            margin: 0,
            textShadow: '0 0 14px rgba(212,163,51,0.45)',
          }}>
            Expenses
          </h1>
          <a href="/leadership/expenses/import" style={{
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
            Import P&L
          </a>
        </div>

        {justImported && (
          <div style={{
            background: 'rgba(63,178,127,0.12)',
            border: '1px solid rgba(63,178,127,0.4)',
            color: '#7cd5a4',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            marginBottom: 14,
            letterSpacing: '0.04em',
          }}>
            Imported {justImported}. Numbers update on the scoreboard immediately.
          </div>
        )}

        {byMonth.size === 0 ? (
          <div style={{
            background: 'linear-gradient(180deg, #121216, #0d0d10)',
            border: '1px solid #2a2a31',
            borderRadius: 8,
            padding: 24,
            color: '#9c9ca3',
            fontSize: 13,
            lineHeight: 1.6,
          }}>
            <p style={{ margin: '0 0 10px 0' }}>No expenses entered yet.</p>
            <p style={{ margin: 0 }}>
              <a href="/leadership/expenses/import" style={{ color: '#d4a333' }}>Import your first month's P&L →</a>
            </p>
          </div>
        ) : (
          [...byMonth.entries()].map(([month, items]) => {
            const total = items.reduce((s, r) => s + (r.amount_cents || 0), 0)
            const monthLabel = month
              ? new Date(month + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' })
              : 'Undated'
            return (
              <section key={month} style={{ marginBottom: 22 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  borderBottom: '1px solid #2a2a31',
                  paddingBottom: 6,
                }}>
                  <h2 style={{
                    color: '#e8e8ea',
                    fontFamily: "'Orbitron', system-ui, sans-serif",
                    fontSize: 13,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}>
                    {monthLabel}
                  </h2>
                  <div style={{
                    color: '#d4a333',
                    fontFamily: "'Orbitron', system-ui, sans-serif",
                    fontSize: 16,
                    fontWeight: 800,
                  }}>
                    {formatCents(total)}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {items.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #1a1a20' }}>
                        <td style={{ padding: '8px 6px', color: '#e8e8ea' }}>
                          {r.qb_account || r.category}
                        </td>
                        <td style={{ padding: '8px 6px', color: '#9c9ca3', fontSize: 11 }}>
                          {r.vendor || ''}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: "'Orbitron', system-ui, sans-serif", fontWeight: 700 }}>
                          {formatCents(r.amount_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })
        )}
      </div>
    </main>
  )
}
