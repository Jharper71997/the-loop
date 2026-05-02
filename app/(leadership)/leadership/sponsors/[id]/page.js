import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect:  { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  committed: { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  paid:      { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  inactive:  { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
}

export default async function SponsorDetail({ params }) {
  const { id } = await params
  const supabase = supabaseAdmin()
  const [sponsorRes, paymentsRes] = await Promise.all([
    supabase.from('sponsors').select('*').eq('id', id).maybeSingle(),
    supabase.from('sponsor_payments').select('*').eq('sponsor_id', id).order('paid_at', { ascending: false }),
  ])
  const sponsor = sponsorRes.data
  if (!sponsor) notFound()
  const payments = paymentsRes.data || []
  const totalPaid = payments.reduce((s, p) => s + (p.amount_cents || 0), 0)
  const sc = STATUS_COLORS[sponsor.status] || STATUS_COLORS.prospect
  const monthlyCents = Math.round(Number(sponsor.amount_committed || 0) * 100)

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/leadership/sponsors" style={backLink}>← Sponsors</a>

        <div style={headerRow}>
          <div>
            <h1 style={titleStyle}>{sponsor.name}</h1>
            {sponsor.tier && <p style={subtitleStyle}>{sponsor.tier}</p>}
          </div>
          <a href={`/leadership/sponsors/${id}/payments/new`} style={primaryButton}>
            + Payment
          </a>
        </div>

        <div style={statsGrid}>
          <Stat label="Status" value={
            <span style={{ background: sc.bg, color: sc.fg, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 4 }}>
              {sponsor.status}
            </span>
          } />
          <Stat label="Monthly" value={monthlyCents > 0 ? formatCents(monthlyCents) : '—'} />
          <Stat label="Total Paid" value={formatCents(totalPaid)} />
          <Stat label="Contact" value={sponsor.contact || '—'} />
        </div>

        {sponsor.notes && (
          <div style={notesBox}>
            <div style={notesLabel}>Notes</div>
            <div style={notesText}>{sponsor.notes}</div>
          </div>
        )}

        <h2 style={sectionHeader}>Payment History</h2>
        {payments.length === 0 ? (
          <div style={emptyState}>
            No payments recorded yet. <a href={`/leadership/sponsors/${id}/payments/new`} style={{ color: '#d4a333' }}>Record the first one.</a>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a31' }}>
                <th style={th}>Date</th>
                <th style={th}>Period</th>
                <th style={th}>Method</th>
                <th style={th}>Reference</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #2a2a31' }}>
                  <td style={td}>{new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={td}>{p.paid_for_period ? new Date(p.paid_for_period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ ...td, textTransform: 'capitalize', color: '#9c9ca3' }}>{p.method}</td>
                  <td style={{ ...td, color: '#9c9ca3', fontSize: 12 }}>{p.reference || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontWeight: 700 }}>{formatCents(p.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #121216, #0d0d10)',
      border: '1px solid #2a2a31',
      borderRadius: 6,
      padding: '12px 14px',
    }}>
      <div style={{ color: '#9c9ca3', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 18, fontWeight: 800, color: '#e8e8ea' }}>
        {value}
      </div>
    </div>
  )
}

const pageStyle = { minHeight: '100vh', background: '#0a0a0b', color: '#e8e8ea', padding: '24px 16px 48px', fontFamily: "'JetBrains Mono', ui-monospace, monospace" }
const containerStyle = { maxWidth: 900, margin: '0 auto' }
const backLink = { color: '#9c9ca3', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block', marginBottom: 18 }
const headerRow = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }
const titleStyle = { color: '#e8e8ea', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }
const subtitleStyle = { color: '#9c9ca3', fontSize: 13, margin: '4px 0 0 0' }
const primaryButton = { background: 'linear-gradient(180deg, #f0c24a, #d4a333)', color: '#0a0a0b', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '10px 16px', borderRadius: 6, textDecoration: 'none', boxShadow: '0 0 20px rgba(212,163,51,0.35)' }
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }
const notesBox = { background: 'linear-gradient(180deg, #121216, #0d0d10)', border: '1px solid #2a2a31', borderRadius: 6, padding: '12px 14px', marginBottom: 22 }
const notesLabel = { color: '#9c9ca3', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }
const notesText = { color: '#e8e8ea', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }
const sectionHeader = { color: '#e8e8ea', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px 0', borderBottom: '1px solid #2a2a31', paddingBottom: 6 }
const emptyState = { color: '#9c9ca3', fontSize: 13, padding: '20px 0' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '8px 6px', color: '#9c9ca3', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }
const td = { padding: '10px 6px', color: '#e8e8ea' }
