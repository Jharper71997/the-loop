import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLeadership } from '@/lib/roles'
import { upcomingWeekends, groupShiftsByDate, NIGHTS, ROLES } from '@/lib/shifts'
import { gcalConfigured, publicCalendarUrl } from '@/lib/googleCalendar'
import { addCrewShift, removeCrewShift } from '@/lib/shiftActions'
import CrewShiftPill from '../../_components/CrewShiftPill'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

const ROLE_STYLE = {
  driver:   { bg: 'rgba(212,163,51,0.15)', fg: '#8a5f0a', border: 'rgba(212,163,51,0.35)' },
  security: { bg: 'rgba(122,162,255,0.15)', fg: '#2457b8', border: 'rgba(122,162,255,0.35)' },
}

const ERRORS = {
  invalid: 'Missing or invalid fields.',
  name_required: 'Pick someone from the roster or type a name.',
  forbidden: 'Only leadership can change the crew schedule.',
}

// Crew sees who is working. Leadership (Jacob + Stephen) can also assign and
// unassign right here, so they don't have to leave the console to do it.
async function viewerIsLeadership() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return isLeadership(user?.email)
}

export default async function AdminSchedulePage({ searchParams }) {
  const sp = await searchParams
  const error = sp?.error
  const supabase = supabaseAdmin()
  const canEdit = await viewerIsLeadership()
  const weekends = upcomingWeekends(canEdit ? 5 : 4)
  const allDates = weekends.flatMap(w => [w.friDate, w.satDate])

  const [{ data: shifts }, { data: drivers }] = await Promise.all([
    supabase
      .from('staff_shifts')
      .select('id, shift_date, night, role, person_name, notes')
      .in('shift_date', allDates)
      .order('shift_date'),
    canEdit
      ? supabase.from('drivers').select('id, name, status').eq('status', 'active').order('name')
      : Promise.resolve({ data: [] }),
  ])

  const byDate = groupShiftsByDate(shifts || [])
  const roster = drivers || []

  return (
    <main style={{
      minHeight: '100dvh',
      background: '#faf5ea',
      color: '#17130f',
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
                color: '#6e6154',
                fontSize: 12,
                textDecoration: 'none',
                border: '1px solid #e8ddc8',
                padding: '6px 12px',
                borderRadius: 6,
              }}
            >
              Open in Google Calendar →
            </a>
          )}
        </div>
        <p style={{ color: '#6e6154', fontSize: 13, margin: '4px 0 22px 0' }}>
          {canEdit
            ? 'Drivers + door security for upcoming weekends. Tap a name to take them off a night; a new name you type joins the crew roster.'
            : 'Drivers + door security for upcoming weekends. Leadership manages this.'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(196,74,58,0.15)',
            border: '1px solid rgba(196,74,58,0.4)',
            color: '#b3311f',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 14,
          }}>
            {ERRORS[error] || error}
          </div>
        )}

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
                color: '#17130f',
                marginBottom: 8,
                borderBottom: '1px solid #e8ddc8',
                paddingBottom: 6,
              }}>
                {w.label}
              </div>

              {empty && !canEdit ? (
                <div style={{ color: '#7d7060', fontSize: 13, padding: '6px 0' }}>
                  Not scheduled yet.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
                  gap: 12,
                }}>
                  {NIGHTS.map(n => {
                    const date = n.key === 'fri' ? w.friDate : w.satDate
                    const slots = byDate[date] || { driver: [], security: [] }
                    const nightEmpty = slots.driver.length === 0 && slots.security.length === 0
                    return (
                      <div key={date} style={{
                        background: '#ffffff',
                        border: '1px solid #e8ddc8',
                        borderRadius: 8,
                        padding: '12px 14px',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                          {n.label} <span style={{ color: '#7d7060', fontWeight: 400 }}>· {date}</span>
                        </div>
                        {nightEmpty && !canEdit ? (
                          <div style={{ color: '#7d7060', fontSize: 12 }}>—</div>
                        ) : ROLES.map(r => {
                          const people = slots[r.key] || []
                          if (people.length === 0 && !canEdit) return null
                          return (
                            <div key={r.key} style={{ marginBottom: 6 }}>
                              <div style={roleLabel}>{r.label}</div>
                              {people.length === 0 ? (
                                <div style={{ color: '#7d7060', fontSize: 12, padding: '2px 0' }}>
                                  None assigned
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {people.map(s => canEdit ? (
                                    <CrewShiftPill
                                      key={s.id}
                                      shift={s}
                                      action={removeCrewShift}
                                      nightLabel={`${n.label} ${date}`}
                                      style={ROLE_STYLE[s.role] || ROLE_STYLE.driver}
                                    />
                                  ) : (
                                    <ShiftBadge key={s.id} shift={s} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {canEdit && (
                          <AssignForm date={date} night={n} roster={roster} />
                        )}
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

function AssignForm({ date, night, roster }) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{
        cursor: 'pointer',
        fontSize: 12,
        color: '#8a5f0a',
        userSelect: 'none',
      }}>
        + Assign someone
      </summary>
      <form action={addCrewShift} style={{ marginTop: 10 }}>
        <input type="hidden" name="shift_date" value={date} />
        <input type="hidden" name="night" value={night.key} />

        <div style={fieldLabel}>Role</div>
        <select name="role" defaultValue="driver" required style={inputStyle}>
          {ROLES.map(r => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>

        <div style={fieldLabel}>From roster</div>
        <select name="driver_id" defaultValue="" style={inputStyle}>
          <option value="">— choose —</option>
          {roster.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
          <option value="custom">Other (type below)</option>
        </select>

        <div style={fieldLabel}>Or someone new</div>
        <input
          type="text"
          name="person_name"
          placeholder="Name (joins the roster)"
          style={inputStyle}
        />

        <div style={fieldLabel}>Notes</div>
        <input type="text" name="notes" placeholder="(optional)" style={inputStyle} />

        <button type="submit" style={submitButton}>
          Add to {night.label}
        </button>
      </form>
    </details>
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

const roleLabel = {
  color: '#6e6154',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 4,
}
const fieldLabel = {
  color: '#6e6154',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  margin: '8px 0 4px 0',
}
const inputStyle = {
  background: '#ffffff',
  border: '1px solid #e8ddc8',
  color: '#17130f',
  fontFamily: FONT_BODY,
  fontSize: 16, // 16px stops iOS from zooming the page on focus
  padding: '8px 10px',
  borderRadius: 6,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}
const submitButton = {
  background: '#d4a333',
  color: '#231903',
  border: 'none',
  fontFamily: FONT_BODY,
  fontSize: 14,
  fontWeight: 600,
  padding: '10px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  width: '100%',
  marginTop: 10,
}
