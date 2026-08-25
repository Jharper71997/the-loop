import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import DeleteForm from '../../../_components/DeleteForm'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect: { bg: 'rgba(111,111,118,0.15)', fg: '#3b322a' },
  active:   { bg: 'rgba(63,178,127,0.15)',  fg: '#0f7a4e' },
  paused:   { bg: 'rgba(212,163,51,0.15)',  fg: '#8a5f0a' },
  inactive: { bg: 'rgba(196,74,58,0.12)',   fg: '#b3311f' },
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
      background: '#ffffff',
      border: '1px solid #e8ddc8',
      borderRadius: 6,
      padding: '12px 14px',
    }}>
      <div style={{ color: '#6e6154', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#17130f' }}>
        {value}
      </div>
    </div>
  )
}

const pageStyle = { minHeight: '100vh', background: '#faf5ea', color: '#17130f', padding: '24px 16px 48px', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }
const containerStyle = { maxWidth: 800, margin: '0 auto' }
const backLink = { color: '#6e6154', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 16 }
const headerRow = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }
const titleStyle = { color: '#17130f', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }
const subtitleStyle = { color: '#6e6154', fontSize: 13, margin: '4px 0 0 0' }
const secondaryButton = { background: 'transparent', color: '#17130f', border: '1px solid #e8ddc8', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }
const notesBox = { background: '#ffffff', border: '1px solid #e8ddc8', borderRadius: 6, padding: '12px 14px', marginBottom: 14 }
const notesLabel = { color: '#6e6154', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }
const notesText = { color: '#17130f', fontSize: 13, lineHeight: 1.5 }
