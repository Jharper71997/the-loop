import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { deriveDelayMinutes } from '@/lib/routeStopLogs'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_NUM = '"JetBrains Mono", ui-monospace, monospace'
const TZ = 'America/Indiana/Indianapolis'

export default async function RouteLogDetail({ params }) {
  const { eventId } = await params
  const supabase = supabaseAdmin()

  const [{ data: event }, { data: stops }] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, event_date, pickup_time, status')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('route_stop_logs')
      .select('*')
      .eq('event_id', eventId)
      .order('stop_index', { ascending: true }),
  ])

  if (!event) notFound()

  const rows = stops || []
  const logged = rows.filter(r => r.actual_arrival_at).length

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/leadership/drivers/route-log" style={backLink}>← Route log</a>

        <div style={headerRow}>
          <div>
            <h1 style={titleStyle}>{event.name || 'Untitled Loop'}</h1>
            <p style={subtitleStyle}>
              {event.event_date ? formatLoopDate(event.event_date) : '—'}
              {' · '}
              <span style={{ fontFamily: FONT_NUM }}>{logged} / {rows.length}</span> logged
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={emptyBox}>
            No stops generated yet. Open this Loop in <a href="/leadership/loops" style={{ color: '#d4a333' }}>Loops</a> and click <strong>Generate route log</strong>.
          </div>
        ) : (
          <div style={tableShell}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a31' }}>
                  <th style={th}>#</th>
                  <th style={th}>Bar</th>
                  <th style={th}>Scheduled</th>
                  <th style={th}>Actual</th>
                  <th style={{ ...th, textAlign: 'right' }}>On</th>
                  <th style={{ ...th, textAlign: 'right' }}>Off</th>
                  <th style={{ ...th, textAlign: 'right' }}>Remaining</th>
                  <th style={{ ...th, textAlign: 'right' }}>Delay</th>
                  <th style={th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const prevCycle = rows[i - 1]?.cycle_index
                  const isCycleBreak = prevCycle != null && prevCycle !== s.cycle_index
                  const delay = deriveDelayMinutes(s.scheduled_at, s.actual_arrival_at)
                  return (
                    <tr key={s.id} style={{
                      borderBottom: '1px solid #2a2a31',
                      borderTop: isCycleBreak ? '2px solid #2a2a31' : undefined,
                    }}>
                      <td style={{ ...td, fontFamily: FONT_NUM, color: '#9c9ca3', width: 40 }}>{s.stop_index}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{s.bar_name}</td>
                      <td style={{ ...td, fontFamily: FONT_NUM, color: '#9c9ca3' }}>{formatTime(s.scheduled_at)}</td>
                      <td style={{ ...td, fontFamily: FONT_NUM, color: s.actual_arrival_at ? '#e8e8ea' : '#6f6f76' }}>
                        {s.actual_arrival_at ? formatTime(s.actual_arrival_at) : '—'}
                      </td>
                      <td style={{ ...td, fontFamily: FONT_NUM, textAlign: 'right' }}>{numOrDash(s.riders_on)}</td>
                      <td style={{ ...td, fontFamily: FONT_NUM, textAlign: 'right' }}>{numOrDash(s.riders_off)}</td>
                      <td style={{ ...td, fontFamily: FONT_NUM, textAlign: 'right' }}>{numOrDash(s.riders_remaining)}</td>
                      <td style={{ ...td, fontFamily: FONT_NUM, textAlign: 'right', ...delayStyle(delay) }}>
                        {formatDelay(delay)}
                      </td>
                      <td style={{ ...td, color: '#9c9ca3', fontSize: 12, maxWidth: 320 }}>{s.notes || ''}</td>
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

function formatTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatLoopDate(iso) {
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function numOrDash(n) {
  if (n === null || n === undefined) return '—'
  return String(n)
}

function formatDelay(min) {
  if (min === null || min === undefined) return '—'
  if (min === 0) return 'on time'
  if (min < 0) return `${Math.abs(min)}m early`
  return `+${min}m`
}

function delayStyle(min) {
  if (min === null || min === undefined) return { color: '#6f6f76' }
  const abs = Math.abs(min)
  if (abs <= 2) return { color: '#3fb27f' }
  if (abs <= 10) return { color: '#d4a333' }
  return { color: '#c44a3a' }
}

const pageStyle = {
  minHeight: '100vh',
  background: '#0a0a0b',
  color: '#e8e8ea',
  padding: '24px 16px 48px',
  fontFamily: FONT_BODY,
}
const containerStyle = { maxWidth: 1200, margin: '0 auto' }
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
  overflow: 'auto',
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
  whiteSpace: 'nowrap',
}
const td = {
  padding: '10px 12px',
  color: '#e8e8ea',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
}
const emptyBox = {
  background: '#121216',
  border: '1px solid #2a2a31',
  borderRadius: 8,
  padding: '20px 22px',
  color: '#9c9ca3',
  fontSize: 14,
}
