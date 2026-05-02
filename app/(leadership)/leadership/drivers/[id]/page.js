import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import DeleteForm from '../../../_components/DeleteForm'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect: { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  active:   { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  paused:   { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  inactive: { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
}

async function deleteDriver(id) {
  'use server'
  const supabase = supabaseAdmin()
  await supabase.from('drivers').delete().eq('id', id)
  revalidatePath('/leadership')
  revalidatePath('/leadership/drivers')
  redirect('/leadership/drivers')
}

export default async function DriverDetail({ params }) {
  const { id } = await params
  const supabase = supabaseAdmin()
  const { data: driver } = await supabase.from('drivers').select('*').eq('id', id).maybeSingle()
  if (!driver) notFound()
  const sc = STATUS_COLORS[driver.status] || STATUS_COLORS.prospect

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/leadership/drivers" style={backLink}>← Drivers</a>

        <div style={headerRow}>
          <div>
            <h1 style={titleStyle}>{driver.name}</h1>
            <p style={subtitleStyle}>{driver.role.charAt(0).toUpperCase() + driver.role.slice(1)}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`/leadership/drivers/${id}/edit`} style={secondaryButton}>Edit</a>
            <DeleteForm action={deleteDriver.bind(null, id)} confirmMessage={`Delete ${driver.name}?`} />
          </div>
        </div>

        <div style={statsGrid}>
          <Stat label="Status" value={
            <span style={{ background: sc.bg, color: sc.fg, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {driver.status}
            </span>
          } />
          <Stat label="Phone" value={driver.phone || '—'} />
          <Stat label="Email" value={driver.email || '—'} />
          <Stat label="Started" value={driver.started_at ? new Date(driver.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
        </div>

        {driver.notes && (
          <div style={notesBox}>
            <div style={notesLabel}>Notes</div>
            <div style={notesText}>{driver.notes}</div>
          </div>
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
      <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8ea' }}>
        {value}
      </div>
    </div>
  )
}

const pageStyle = { minHeight: '100vh', background: '#0a0a0b', color: '#e8e8ea', padding: '24px 16px 48px', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }
const containerStyle = { maxWidth: 800, margin: '0 auto' }
const backLink = { color: '#9c9ca3', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 16 }
const headerRow = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }
const titleStyle = { color: '#e8e8ea', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }
const subtitleStyle = { color: '#9c9ca3', fontSize: 13, margin: '4px 0 0 0' }
const secondaryButton = { background: 'transparent', color: '#e8e8ea', border: '1px solid #2a2a31', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }
const notesBox = { background: '#121216', border: '1px solid #2a2a31', borderRadius: 6, padding: '12px 14px', marginBottom: 14 }
const notesLabel = { color: '#9c9ca3', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }
const notesText = { color: '#e8e8ea', fontSize: 13, lineHeight: 1.5 }
