import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { upcomingWeekends, groupShiftsByDate, NIGHTS, ROLES } from '@/lib/shifts'
import { gcalConfigured, publicCalendarUrl } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

const ROLE_STYLE = {
  driver:   { bg: 'rgba(212,163,51,0.15)', fg: '#d4a333', border: 'rgba(212,163,51,0.35)' },
  security: { bg: 'rgba(122,162,255,0.15)', fg: '#7aa2ff', border: 'rgba(122,162,255,0.35)' },
}

export default async function AdminSchedulePage() {
  const supabase = supabaseAdmin()
  const weekends = upcomingWeekends(4)
  const allDates = weekends.flatMap(w => [w.friDate, w.satDate])

  const { data: shifts } = await supabase
    .from('staff_shifts')
    .select('id, shift_date, night, role, person_name, notes')
    .in('shift_date', allDates)
    .order('shift_date')

  const byDate = groupShiftsByDate(shifts || [])

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '20px 14px 48px',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 6,
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            Who's working
          </h1>
          {publicCalendarUrl() && gcalConfigured() && (
            <a
              href={publicCalendarUrl()}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#9c9ca3',
                fontSize: 12,
                textDecoration: 'none',
                border: '1px solid #2a2a31',
                padding: '6px 12px',
                borderRadius: 6,
              }}
            >
              Open in Google Calendar →
            </a>
          )}
        </div>
        <p style={{ color: '#9c9ca3', fontSize: 13, margin: '4px 0 22px 0' }}>
          Drivers + door security for upcoming weekends. Leadership manages this.
        </p>

        {weekends.map(w => {
          const friSlots = byDate[w.friDate] || { driver: [], security: [] }
          const satSlots = byDate[w.satDate] || { driver: [], security: [] }
          const empty = friSlots.driver.length === 0 && friSlots.security.length === 0
            && satSlots.driver.length === 0 && satSlots.security.length === 0
          return (
            <section key={w.friDate} style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#e8e8ea',
                marginBottom: 8,
                borderBottom: '1px solid #2a2a31',
                paddingBottom: 6,
              }}>
                {w.label}
              </div>

              {empty ? (
                <div style={{ color: '#6f6f76', fontSize: 13, padding: '6px 0' }}>
                  Not scheduled yet.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 12,
                }}>
                  {NIGHTS.map(n => {
                    const date = n.key === 'fri' ? w.friDate : w.satDate
                    const slots = byDate[date] || { driver: [], security: [] }
                    const nightEmpty = slots.driver.length === 0 && slots.security.length === 0
                    return (
                      <div key={date} style={{
                        background: '#121216',
                        border: '1px solid #2a2a31',
                        borderRadius: 8,
                        padding: '12px 14px',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                          {n.label} <span style={{ color: '#6f6f76', fontWeight: 400 }}>· {date}</span>
                        </div>
                        {nightEmpty ? (
                          <div style={{ color: '#6f6f76', fontSize: 12 }}>—</div>
                        ) : ROLES.map(r => (
                          (slots[r.key] || []).length > 0 && (
                            <div key={r.key} style={{ marginBottom: 6 }}>
                              <div style={{
                                color: '#9c9ca3',
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                marginBottom: 4,
                              }}>
                                {r.label}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {slots[r.key].map(s => (
                                  <ShiftBadge key={s.id} shift={s} />
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}

function ShiftBadge({ shift }) {
  const style = ROLE_STYLE[shift.role] || ROLE_STYLE.driver
  return (
    <span
      title={shift.notes || undefined}
      style={{
        background: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`,
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
      }}
    >
      {shift.person_name}
    </span>
  )
}
