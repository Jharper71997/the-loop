import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_NUM = '"JetBrains Mono", ui-monospace, monospace'

const STATUS_COLORS = {
  prospect: { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  active:   { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  paused:   { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  inactive: { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
}

export default async function DriversPage() {
  const supabase = supabaseAdmin()
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, phone, email, status, role, started_at, notes')
    .order('status')
    .order('name')

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <a href="/leadership" style={{
          color: '#9c9ca3',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 16,
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
            color: '#e8e8ea',
            fontFamily: FONT_BODY,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            Drivers
          </h1>
          <a href="/leadership/drivers/new" style={{
            background: '#d4a333',
            color: '#0a0a0b',
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 6,
            textDecoration: 'none',
          }}>
            + Add driver
          </a>
        </div>

        {(drivers || []).length === 0 ? (
          <div style={{ color: '#9c9ca3', fontSize: 14, padding: '20px 0' }}>
            No drivers yet. <a href="/leadership/drivers/new" style={{ color: '#d4a333' }}>Add the first one →</a>
          </div>
        ) : (
          <div style={{
            background: '#121216',
            border: '1px solid #2a2a31',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a31' }}>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Role</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Email</th>
                  <th style={th}>Started</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => {
                  const sc = STATUS_COLORS[d.status] || STATUS_COLORS.prospect
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid #2a2a31' }}>
                      <td style={td}>
                        <a href={`/leadership/drivers/${d.id}`} style={{ fontWeight: 600, color: '#e8e8ea', textDecoration: 'none' }}>{d.name}</a>
                        {d.notes && <div style={{ fontSize: 12, color: '#9c9ca3', marginTop: 2 }}>{d.notes}</div>}
                      </td>
                      <td style={td}>
                        <span style={{
                          background: sc.bg,
                          color: sc.fg,
                          fontSize: 11,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                        }}>{d.status}</span>
                      </td>
                      <td style={{ ...td, textTransform: 'capitalize', color: '#9c9ca3' }}>{d.role}</td>
                      <td style={{ ...td, fontFamily: FONT_NUM, color: '#9c9ca3', fontSize: 13 }}>{d.phone || '—'}</td>
                      <td style={{ ...td, color: '#9c9ca3', fontSize: 13 }}>{d.email || '—'}</td>
                      <td style={{ ...td, color: '#9c9ca3', fontSize: 13 }}>
                        {d.started_at ? new Date(d.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

const th = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#9c9ca3',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: '#0d0d10',
}
const td = {
  padding: '12px',
  color: '#e8e8ea',
  verticalAlign: 'top',
}
