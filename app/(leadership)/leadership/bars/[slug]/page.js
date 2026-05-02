import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'
import DeleteForm from '../../../_components/DeleteForm'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect: { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  active:   { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  paused:   { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  inactive: { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
}

async function deleteBar(slug) {
  'use server'
  const supabase = supabaseAdmin()
  await supabase.from('bars').delete().eq('slug', slug)
  revalidatePath('/leadership')
  revalidatePath('/leadership/bars')
  redirect('/leadership/bars')
}

export default async function BarDetail({ params }) {
  const { slug } = await params
  const supabase = supabaseAdmin()
  const [barRes, paymentsRes] = await Promise.all([
    supabase.from('bars').select('*').eq('slug', slug).maybeSingle(),
    supabase.from('bar_payments').select('*').eq('bar_slug', slug).order('paid_at', { ascending: false }),
  ])
  const bar = barRes.data
  if (!bar) notFound()
  const payments = paymentsRes.data || []
  const totalPaid = payments.reduce((s, p) => s + (p.amount_cents || 0), 0)
  const sc = STATUS_COLORS[bar.status] || STATUS_COLORS.prospect

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/leadership/bars" style={backLink}>← Bars</a>

        <div style={headerRow}>
          <div>
            <h1 style={titleStyle}>{bar.name}</h1>
            <p style={subtitleStyle}>{bar.slug}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/leadership/bars/${slug}/payments/new`} style={primaryButton}>+ Payment</a>
            <a href={`/leadership/bars/${slug}/edit`} style={secondaryButton}>Edit</a>
            <DeleteForm
              action={deleteBar.bind(null, slug)}
              confirmMessage={`Delete ${bar.name}? This also deletes all their payment records.`}
            />
          </div>
        </div>

        <div style={statsGrid}>
          <Stat label="Status" value={
            <span style={{ background: sc.bg, color: sc.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {bar.status}
            </span>
          } />
          <Stat label="Monthly" value={bar.monthly_fee_cents > 0 ? formatCents(bar.monthly_fee_cents) : '—'} />
          <Stat label="Method" value={(bar.payment_method || '—').charAt(0).toUpperCase() + (bar.payment_method || '').slice(1)} />
          <Stat label="Total Paid" value={formatCents(totalPaid)} />
        </div>

        {(bar.contact_name || bar.contact_phone || bar.contact_email) && (
          <div style={notesBox}>
            <div style={notesLabel}>Contact</div>
            <div style={notesText}>
              {bar.contact_name && <div>{bar.contact_name}</div>}
              {bar.contact_phone && <div style={{ color: '#9c9ca3' }}>{bar.contact_phone}</div>}
              {bar.contact_email && <div style={{ color: '#9c9ca3' }}>{bar.contact_email}</div>}
            </div>
          </div>
        )}

        {bar.notes && (
          <div style={notesBox}>
            <div style={notesLabel}>Notes</div>
            <div style={notesText}>{bar.notes}</div>
          </div>
        )}

        <h2 style={sectionHeader}>Payment History</h2>
        {payments.length === 0 ? (
          <div style={emptyState}>
            No payments recorded yet. <a href={`/leadership/bars/${slug}/payments/new`} style={{ color: '#d4a333' }}>Record the first one.</a>
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
      background: '#121216',
      border: '1px solid #2a2a31',
      borderRadius: 6,
      padding: '12px 14px',
    }}>
      <div style={{ color: '#9c9ca3', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 18, fontWeight: 600, color: '#e8e8ea' }}>
        {value}
      </div>
    </div>
  )
}

const pageStyle = { minHeight: '100vh', background: '#0a0a0b', color: '#e8e8ea', padding: '24px 16px 48px', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }
const containerStyle = { maxWidth: 900, margin: '0 auto' }
const backLink = { color: '#9c9ca3', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 16 }
const headerRow = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }
const titleStyle = { color: '#e8e8ea', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }
const subtitleStyle = { color: '#9c9ca3', fontSize: 13, margin: '4px 0 0 0' }
const primaryButton = { background: '#d4a333', color: '#0a0a0b', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }
const secondaryButton = { background: 'transparent', color: '#e8e8ea', border: '1px solid #2a2a31', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }
const notesBox = { background: '#121216', border: '1px solid #2a2a31', borderRadius: 6, padding: '12px 14px', marginBottom: 14 }
const notesLabel = { color: '#9c9ca3', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }
const notesText = { color: '#e8e8ea', fontSize: 13, lineHeight: 1.5 }
const sectionHeader = { color: '#e8e8ea', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '14px 0 12px 0', borderBottom: '1px solid #2a2a31', paddingBottom: 6 }
const emptyState = { color: '#9c9ca3', fontSize: 14, padding: '20px 0' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const th = { textAlign: 'left', padding: '8px 6px', color: '#9c9ca3', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }
const td = { padding: '10px 6px', color: '#e8e8ea' }
