import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'
import StatCard from '../../_components/StatCard'
import DataTable from '../../_components/DataTable'
import ShowMore from '../../_components/ShowMore'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace'

// Show the latest 12 months in the matrix. Anything older lands in the
// flat-list detail at the bottom under "Older months".
const MONTH_WINDOW = 12

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}
function monthLabelLong(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export default async function ExpensesPage({ searchParams }) {
  const sp = await searchParams
  const justImported = sp?.imported

  const supabase = supabaseAdmin()
  const { data: rows } = await supabase
    .from('expenses')
    .select('id, qb_account, qb_category, category, amount_cents, expense_date, notes, vendor')
    .order('expense_date', { ascending: false })
    .limit(2000)

  const allRows = rows || []

  // Build the visible-month set from the window. We always show every month
  // in the window even if it's empty (so jumps are obvious).
  const today = new Date()
  const visibleMonths = []
  for (let i = 0; i < MONTH_WINDOW; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    visibleMonths.push(monthKey(d))
  }
  const visibleSet = new Set(visibleMonths)

  // Trim leading empty months so we don't render a desert of zeros for months
  // that haven't happened yet or that predate any data. Keep at least 4 visible.
  const monthsWithData = new Set(allRows.map(r => (r.expense_date || '').slice(0, 7)))
  while (visibleMonths.length > 4 && !monthsWithData.has(visibleMonths[0])) {
    visibleMonths.shift()
  }
  while (visibleMonths.length > 4 && !monthsWithData.has(visibleMonths[visibleMonths.length - 1])) {
    visibleMonths.pop()
  }
  const trimmedSet = new Set(visibleMonths)

  // Category × month matrix. Bucket key: prefer human-readable qb_account,
  // fall back to qb_category, then to the legacy 'category' column.
  function bucketKey(r) {
    return r.qb_account || r.qb_category || r.category || 'Uncategorized'
  }
  const categoryTotals = new Map() // bucket -> Map(month -> cents)
  const categoryYtd = new Map()    // bucket -> cents (across visible window)
  let hasSplitFlag = false

  for (const r of allRows) {
    const month = (r.expense_date || '').slice(0, 7)
    if (!trimmedSet.has(month)) continue
    const bucket = bucketKey(r)
    if (!categoryTotals.has(bucket)) categoryTotals.set(bucket, new Map())
    const m = categoryTotals.get(bucket)
    m.set(month, (m.get(month) || 0) + (r.amount_cents || 0))
    categoryYtd.set(bucket, (categoryYtd.get(bucket) || 0) + (r.amount_cents || 0))
    if (typeof r.notes === 'string' && /split evenly/i.test(r.notes)) hasSplitFlag = true
  }

  // Sort categories by total spend across the visible window (descending).
  const sortedCategories = [...categoryYtd.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([bucket]) => bucket)

  // Column totals + grand total.
  const monthTotals = new Map(visibleMonths.map(m => [m, 0]))
  let grandTotal = 0
  for (const bucket of sortedCategories) {
    const row = categoryTotals.get(bucket)
    for (const m of visibleMonths) {
      const cents = row.get(m) || 0
      monthTotals.set(m, monthTotals.get(m) + cents)
      grandTotal += cents
    }
  }

  const monthsWithDataInWindow = visibleMonths.filter(m => (monthTotals.get(m) || 0) > 0)
  const avgMonthly = monthsWithDataInWindow.length > 0
    ? Math.round(grandTotal / monthsWithDataInWindow.length)
    : 0
  const latestMonth = monthsWithDataInWindow[0] || null
  const latestMonthCents = latestMonth ? monthTotals.get(latestMonth) : 0

  const topCategoryName = sortedCategories[0]
  const topCategoryCents = topCategoryName ? categoryYtd.get(topCategoryName) : 0
  const topCategoryShare = grandTotal > 0 ? topCategoryCents / grandTotal : 0

  // Older months (outside window) for an "older months" rollup.
  const olderTotals = new Map()
  for (const r of allRows) {
    const month = (r.expense_date || '').slice(0, 7)
    if (trimmedSet.has(month)) continue
    olderTotals.set(month, (olderTotals.get(month) || 0) + (r.amount_cents || 0))
  }
  const olderMonths = [...olderTotals.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Link href="/leadership/income" style={{
          color: '#9c9ca3',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 18,
        }}>
          ← Income
        </Link>

        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 6,
        }}>
          <h1 style={{
            color: '#e8e8ea',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            Expenses
          </h1>
          <Link href="/leadership/expenses/import" style={{
            background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
            color: '#0a0a0b',
            fontFamily: FONT_MONO,
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
          </Link>
        </div>
        <p style={{ color: '#9c9ca3', fontSize: 13, margin: '0 0 22px 0' }}>
          From Diamond&rsquo;s monthly QuickBooks P&L. Sorted by spend so the biggest line items rise to the top.
        </p>

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

        {grandTotal === 0 ? (
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
              <Link href="/leadership/expenses/import" style={{ color: '#d4a333' }}>Import your first month&rsquo;s P&L →</Link>
            </p>
          </div>
        ) : (
          <>
            {/* KPI tiles */}
            <div className="exp-kpis" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}>
              <StatCard
                label={`Total · ${monthsWithDataInWindow.length} mo`}
                value={formatCents(grandTotal)}
                hint={`${visibleMonths.length}-month window`}
              />
              <StatCard
                label={latestMonth ? monthLabelLong(latestMonth) : 'Latest'}
                value={formatCents(latestMonthCents)}
                hint={latestMonth ? 'most recent close' : ''}
              />
              <StatCard
                label="Avg / month"
                value={formatCents(avgMonthly)}
                hint={`across ${monthsWithDataInWindow.length || 0} populated months`}
              />
              <StatCard
                label="Largest"
                value={topCategoryName || '—'}
                mono={false}
                hint={topCategoryCents ? `${formatCents(topCategoryCents)} · ${(topCategoryShare * 100).toFixed(0)}% of spend` : ''}
              />
            </div>

            {/* Matrix */}
            <section style={{ marginBottom: 18 }}>
              <h2 style={sectionHeading}>By category</h2>
              <div style={tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_BODY }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2a2a31' }}>
                      <th style={{ ...th, textAlign: 'left', minWidth: 180 }}>Category</th>
                      {visibleMonths.map(m => (
                        <th key={m} style={{ ...th, textAlign: 'right' }}>{monthLabel(m)}</th>
                      ))}
                      <th style={{ ...th, textAlign: 'right', borderLeft: '1px solid #2a2a31', color: '#d4a333' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCategories.map((bucket) => {
                      const row = categoryTotals.get(bucket)
                      const ytd = categoryYtd.get(bucket) || 0
                      const share = grandTotal > 0 ? ytd / grandTotal : 0
                      return (
                        <tr key={bucket} style={{ borderBottom: '1px solid #1a1a20' }}>
                          <td style={{ ...td, textAlign: 'left' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ color: '#e8e8ea', fontSize: 13, fontWeight: 500 }}>{bucket}</span>
                              <span style={{ color: '#6e6e75', fontSize: 10, letterSpacing: '0.04em', fontFamily: FONT_MONO }}>
                                {(share * 100).toFixed(0)}% of spend
                              </span>
                            </div>
                          </td>
                          {visibleMonths.map(m => {
                            const cents = row.get(m) || 0
                            return (
                              <td key={m} style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, color: cents ? '#e8e8ea' : '#3a3a42' }}>
                                {cents ? formatCents(cents) : '—'}
                              </td>
                            )
                          })}
                          <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: '#d4a333', borderLeft: '1px solid #2a2a31' }}>
                            {formatCents(ytd)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #2a2a31' }}>
                      <td style={{ ...td, textAlign: 'left', color: '#9c9ca3', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
                        Total
                      </td>
                      {visibleMonths.map(m => {
                        const cents = monthTotals.get(m) || 0
                        return (
                          <td key={m} style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: cents ? '#e8e8ea' : '#3a3a42' }}>
                            {cents ? formatCents(cents) : '—'}
                          </td>
                        )
                      })}
                      <td style={{ ...td, textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 800, color: '#d4a333', fontSize: 14, borderLeft: '1px solid #2a2a31' }}>
                        {formatCents(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {hasSplitFlag && (
                <div style={{
                  marginTop: 10,
                  color: '#9c9ca3',
                  fontSize: 11,
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                }}>
                  ⓘ Some months show a quarterly aggregate split evenly across Jan/Feb/Mar — Diamond hasn&rsquo;t provided per-month breakdowns. Re-import via the form once she does.
                </div>
              )}
            </section>

            {olderMonths.length > 0 && (
              <section style={{ marginTop: 22 }}>
                <h2 style={sectionHeading}>Older months</h2>
                <ShowMore label="older months" count={olderMonths.length}>
                  <DataTable
                    columns={[
                      { key: 'month', header: 'Month', primary: true, render: r => monthLabelLong(r.month) },
                      { key: 'amount', header: 'Amount', align: 'right', mono: true, render: r => <span style={{ color: '#9c9ca3' }}>{formatCents(r.cents)}</span> },
                    ]}
                    rows={olderMonths.map(([month, cents]) => ({ month, cents }))}
                    rowKey={r => r.month}
                  />
                </ShowMore>
              </section>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .exp-kpis { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 520px) {
          .exp-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}

const sectionHeading = {
  color: '#e8e8ea',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  margin: '0 0 10px 0',
  borderBottom: '1px solid #2a2a31',
  paddingBottom: 6,
}

const tableWrap = {
  background: 'linear-gradient(180deg, #121216, #0d0d10)',
  border: '1px solid #2a2a31',
  borderRadius: 8,
  padding: '4px 12px',
  overflowX: 'auto',
}

const th = {
  padding: '12px 8px',
  color: '#9c9ca3',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const td = {
  padding: '10px 8px',
  fontSize: 13,
  whiteSpace: 'nowrap',
}
