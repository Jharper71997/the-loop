import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_NUM = '"JetBrains Mono", ui-monospace, monospace'

export default async function RouteLogIndex() {
  const supabase = supabaseAdmin()

  // One trip: pull every row, count per event, then join the events meta.
  const { data: rows } = await supabase
    .from('route_stop_logs')
    .select('event_id, actual_arrival_at')

  const byEvent = new Map()
  for (const r of rows || []) {
    const e = byEvent.get(r.event_id) || { total: 0, logged: 0 }
    e.total += 1
    if (r.actual_arrival_at) e.logged += 1
    byEvent.set(r.event_id, e)
  }

  let events = []
  if (byEvent.size) {
    const { data } = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time, status')
      .in('id', [...byEvent.keys()])
    events = (data || [])
      .map(e => ({ ...e, ...(byEvent.get(e.id) || { total: 0, logged: 0 }) }))
      .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/leadership/drivers" style={backLink}>← Drivers</a>

        <div style={headerRow}>
          <div>
            <h1 style={titleStyle}>Route log</h1>
            <p style={subtitleStyle}>Per-stop tracker filled live by drivers on /admin/driver.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div style={emptyBox}>
            No route logs yet. Open a Loop in <a href="/leadership/loops" style={{ color: '#d4a333' }}>Loops</a> and click <strong>Generate route log</strong> to seed the 25 stops.
          </div>
        ) : (
          <div style={tableShell}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a31' }}>
                  <th style={th}>Loop</th>
                  <th style={th}>Date</th>
                  <th style={th}>Logged</th>
                  <th style={th}>Status</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => {
                  const pct = e.total ? Math.round((e.logged / e.total) * 100) : 0
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid #2a2a31' }}>
                      <td style={td}>
                        <a href={`/leadership/drivers/route-log/${e.id}`} style={{ fontWeight: 600, color: '#e8e8ea', textDecoration: 'none' }}>
                          {e.name || 'Untitled Loop'}
                        </a>
                      </td>
                      <td style={{ ...td, color: '#9c9ca3', fontSize: 13 }}>
                        {e.event_date ? formatLoopDate(e.event_date) : '—'}
                      </td>
                      <td style={{ ...td, fontFamily: FONT_NUM, color: '#e8e8ea', fontSize: 13 }}>
                        {e.logged} / {e.total}
                      </td>
                      <td style={td}>
                        <ProgressBar pct={pct} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <a href={`/leadership/drivers/route-log/${e.id}`} style={viewLink}>view →</a>
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

function ProgressBar({ pct }) {
  return (
    <div style={{
      width: 120,
      height: 6,
      background: '#0d0d10',
      borderRadius: 3,
      overflow: 'hidden',
      border: '1px solid #2a2a31',
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: pct >= 100 ? '#3fb27f' : '#d4a333',
      }} />
    </div>
  )
}

function formatLoopDate(iso) {
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

const pageStyle = {
  minHeight: '100vh',
  background: '#0a0a0b',
  color: '#e8e8ea',
  padding: '24px 16px 48px',
  fontFamily: FONT_BODY,
}
const containerStyle = { maxWidth: 1100, margin: '0 auto' }
const backLink = {
  color: '#9c9ca3',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  display: 'inline-block',
  marginBottom: 16,
}
const headerRow = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  marginBottom: 22,
}
const titleStyle = {
  color: '#e8e8ea',
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  margin: 0,
}
const subtitleStyle = {
  color: '#9c9ca3',
  fontSize: 13,
  margin: '4px 0 0 0',
}
const tableShell = {
  background: '#121216',
  border: '1px solid #2a2a31',
  borderRadius: 8,
  overflow: 'hidden',
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
const td = { padding: '12px', color: '#e8e8ea', verticalAlign: 'middle' }
const viewLink = { color: '#d4a333', fontSize: 13, textDecoration: 'none', fontWeight: 500 }
const emptyBox = {
  background: '#121216',
  border: '1px solid #2a2a31',
  borderRadius: 8,
  padding: '20px 22px',
  color: '#9c9ca3',
  fontSize: 14,
}
