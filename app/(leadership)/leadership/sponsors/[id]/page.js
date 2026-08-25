import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'
import DeleteForm from '../../../_components/DeleteForm'

export const dynamic = 'force-dynamic'

async function deleteSponsor(id) {
  'use server'
  const supabase = supabaseAdmin()
  await supabase.from('sponsors').delete().eq('id', id)
  revalidatePath('/leadership')
  revalidatePath('/leadership/sponsors')
  redirect('/leadership/sponsors')
}

const STATUS_COLORS = {
  prospect:  { bg: 'rgba(111,111,118,0.15)', fg: '#3b322a' },
  committed: { bg: 'rgba(212,163,51,0.15)',  fg: '#8a5f0a' },
  paid:      { bg: 'rgba(63,178,127,0.15)',  fg: '#0f7a4e' },
  inactive:  { bg: 'rgba(196,74,58,0.12)',   fg: '#b3311f' },
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/leadership/sponsors/${id}/payments/new`} style={primaryButton}>
              + Payment
            </a>
            <a href={`/leadership/sponsors/${id}/edit`} style={secondaryButton}>
              Edit
            </a>
            <DeleteForm
              action={deleteSponsor.bind(null, id)}
              confirmMessage={`Delete ${sponsor.name}? This also deletes all their payment records.`}
            />
          </div>
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
            No payments recorded yet. <a href={`/leadership/sponsors/${id}/payments/new`} style={{ color: '#8a5f0a' }}>Record the first one.</a>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8ddc8' }}>
                <th style={th}>Date</th>
                <th style={th}>Period</th>
                <th style={th}>Method</th>
                <th style={th}>Reference</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e8ddc8' }}>
                  <td style={td}>{new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={td}>{p.paid_for_period ? new Date(p.paid_for_period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ ...td, textTransform: 'capitalize', color: '#6e6154' }}>{p.method}</td>
                  <td style={{ ...td, color: '#6e6154', fontSize: 12 }}>{p.reference || '—'}</td>
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
      background: 'linear-gradient(180deg, #ffffff, #fdfaf3)',
      border: '1px solid #e8ddc8',
      borderRadius: 6,
      padding: '12px 14px',
    }}>
      <div style={{ color: '#6e6154', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 18, fontWeight: 800, color: '#17130f' }}>
        {value}
      </div>
    </div>
  )
}

const pageStyle = { minHeight: '100vh', background: '#faf5ea', color: '#17130f', padding: '24px 16px 48px', fontFamily: 'inherit' }
const containerStyle = { maxWidth: 900, margin: '0 auto' }
const backLink = { color: '#6e6154', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block', marginBottom: 18 }
const headerRow = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }
const titleStyle = { color: '#17130f', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }
const subtitleStyle = { color: '#6e6154', fontSize: 13, margin: '4px 0 0 0' }
const primaryButton = { background: '#d4a333', color: '#231903', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }
const secondaryButton = { background: 'transparent', color: '#17130f', border: '1px solid #e8ddc8', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }
const notesBox = { background: 'linear-gradient(180deg, #ffffff, #fdfaf3)', border: '1px solid #e8ddc8', borderRadius: 6, padding: '12px 14px', marginBottom: 22 }
const notesLabel = { color: '#6e6154', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }
const notesText = { color: '#17130f', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }
const sectionHeader = { color: '#17130f', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px 0', borderBottom: '1px solid #e8ddc8', paddingBottom: 6 }
const emptyState = { color: '#6e6154', fontSize: 13, padding: '20px 0' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '8px 6px', color: '#6e6154', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }
const td = { padding: '10px 6px', color: '#17130f' }
