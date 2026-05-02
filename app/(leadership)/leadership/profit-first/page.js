// Placeholder for Profit First view (Evening 6).
// Will render a 5-bucket allocation table (Reserve / Tax / Owner / OpEx / COGS)
// with actual vs target vs variance, MTD / QTD / YTD toggle, color-coded variance.

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export default async function ProfitFirstPage() {
  const supabase = supabaseAdmin()
  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  const { data: target } = await supabase
    .from('profit_first_targets')
    .select('*')
    .eq('year', year)
    .eq('quarter', quarter)
    .maybeSingle()

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
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
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 22,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          margin: '0 0 6px 0',
          textShadow: '0 0 14px rgba(212,163,51,0.45)',
        }}>
          Profit First
        </h1>
        <p style={{ color: '#9c9ca3', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 22px 0' }}>
          {year} · Q{quarter}
        </p>

        <div style={{
          background: 'linear-gradient(180deg, #121216, #0d0d10)',
          border: '1px solid #2a2a31',
          borderRadius: 8,
          padding: '20px 22px',
          marginBottom: 18,
        }}>
          <h2 style={{
            color: '#e8e8ea',
            fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: '0 0 14px 0',
          }}>
            Targets
          </h2>
          {target ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {[
                  ['Profit Reserve', target.reserve_pct],
                  ['Taxes',          target.tax_pct],
                  ["Owner's Pay",    target.owner_pct],
                  ['Operating Exp.', target.opex_pct],
                  ['COGS',           target.cogs_pct],
                ].map(([label, pct]) => (
                  <tr key={label} style={{ borderBottom: '1px solid #2a2a31' }}>
                    <td style={{ padding: '10px 6px', color: '#9c9ca3', letterSpacing: '0.04em' }}>{label}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontWeight: 700 }}>
                      {(Number(pct) * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#9c9ca3', fontSize: 13 }}>No targets set for {year} Q{quarter}.</div>
          )}
        </div>

        <div style={{
          background: 'linear-gradient(180deg, #121216, #0d0d10)',
          border: '1px solid #2a2a31',
          borderRadius: 8,
          padding: '20px 22px',
          color: '#9c9ca3',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          Actual / variance computation lands Evening 6 (after Diamond's sheet integration).
          Targets above are editable per quarter via the database (no UI yet).
        </div>
      </div>
    </main>
  )
}
