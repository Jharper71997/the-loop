import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { upcomingWeekends, groupShiftsByDate, NIGHTS, ROLES } from '@/lib/shifts'
import { pushShiftToGCal, deleteShiftFromGCal, gcalConfigured, publicCalendarUrl } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

const ROLE_STYLE = {
  driver:   { bg: 'rgba(212,163,51,0.15)', fg: '#d4a333', border: 'rgba(212,163,51,0.35)' },
  security: { bg: 'rgba(122,162,255,0.15)', fg: '#7aa2ff', border: 'rgba(122,162,255,0.35)' },
}

async function addShift(formData) {
  'use server'
  const shift_date = (formData.get('shift_date') || '').toString()
  const night = (formData.get('night') || '').toString()
  const role = (formData.get('role') || '').toString()
  const driverIdRaw = (formData.get('driver_id') || '').toString()
  const driver_id = driverIdRaw && driverIdRaw !== 'custom' ? driverIdRaw : null
  const customName = (formData.get('person_name') || '').toString().trim()
  const notes = (formData.get('notes') || '').toString().trim() || null

  if (!shift_date || !['fri', 'sat'].includes(night) || !['driver', 'security'].includes(role)) {
    redirect('/leadership/schedule?error=invalid')
  }

  const supabase = supabaseAdmin()
  let person_name = customName
  if (driver_id) {
    const { data: d } = await supabase.from('drivers').select('name').eq('id', driver_id).maybeSingle()
    if (d?.name) person_name = d.name
  }
  if (!person_name) {
    redirect('/leadership/schedule?error=name_required')
  }

  const { data: inserted, error } = await supabase
    .from('staff_shifts')
    .insert({ shift_date, night, role, driver_id, person_name, notes })
    .select()
    .single()
  if (error) {
    redirect('/leadership/schedule?error=' + encodeURIComponent(error.message))
  }

  const eventId = await pushShiftToGCal(inserted)
  if (eventId) {
    await supabase.from('staff_shifts').update({ gcal_event_id: eventId }).eq('id', inserted.id)
  }

  revalidatePath('/leadership/schedule')
  revalidatePath('/admin/schedule')
  redirect('/leadership/schedule')
}

async function deleteShift(formData) {
  'use server'
  const id = (formData.get('id') || '').toString()
  if (!id) redirect('/leadership/schedule')

  const supabase = supabaseAdmin()
  const { data: existing } = await supabase
    .from('staff_shifts')
    .select('id, gcal_event_id')
    .eq('id', id)
    .maybeSingle()

  if (existing?.gcal_event_id) {
    await deleteShiftFromGCal(existing.gcal_event_id)
  }
  await supabase.from('staff_shifts').delete().eq('id', id)

  revalidatePath('/leadership/schedule')
  revalidatePath('/admin/schedule')
  redirect('/leadership/schedule')
}

export default async function LeadershipSchedulePage({ searchParams }) {
  const sp = await searchParams
  const error = sp?.error
  const supabase = supabaseAdmin()

  const weekends = upcomingWeekends(5)
  const allDates = weekends.flatMap(w => [w.friDate, w.satDate])

  const [{ data: shifts }, { data: drivers }] = await Promise.all([
    supabase
      .from('staff_shifts')
      .select('id, shift_date, night, role, driver_id, person_name, notes, gcal_event_id')
      .in('shift_date', allDates)
      .order('shift_date'),
    supabase
      .from('drivers')
      .select('id, name, status')
      .order('name'),
  ])

  const byDate = groupShiftsByDate(shifts || [])
  const activeDrivers = (drivers || []).filter(d => d.status === 'active')

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
          marginBottom: 6,
        }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            Schedule
          </h1>
          {publicCalendarUrl() && (
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
              Open Google Calendar →
            </a>
          )}
        </div>
        <p style={{ color: '#9c9ca3', fontSize: 13, margin: '4px 0 22px 0' }}>
          Drivers + door security, Friday & Saturday nights.{' '}
          {gcalConfigured()
            ? 'Each shift you add is pushed to the shared Google Calendar.'
            : 'Google Calendar sync is not configured yet — shifts save to The Loop only.'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(196,74,58,0.15)',
            border: '1px solid rgba(196,74,58,0.4)',
            color: '#f4b8ad',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 14,
          }}>
            {error === 'invalid' ? 'Missing or invalid fields.'
              : error === 'name_required' ? 'Pick a person from the roster or type a name.'
              : error}
          </div>
        )}

        {weekends.map(w => (
          <section key={w.friDate} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 10,
              borderBottom: '1px solid #2a2a31',
              paddingBottom: 6,
            }}>
              <h2 style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                margin: 0,
              }}>
                {w.label}
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
            }}>
              {NIGHTS.map(n => {
                const date = n.key === 'fri' ? w.friDate : w.satDate
                const slots = byDate[date] || { driver: [], security: [] }
                return (
                  <div key={date} style={{
                    background: '#121216',
                    border: '1px solid #2a2a31',
                    borderRadius: 8,
                    padding: '14px 16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {n.label} <span style={{ color: '#6f6f76', fontWeight: 400 }}>· {date}</span>
                      </div>
                    </div>

                    {ROLES.map(r => (
                      <div key={r.key} style={{ marginBottom: 10 }}>
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
                        {(slots[r.key] || []).length === 0 ? (
                          <div style={{ color: '#6f6f76', fontSize: 12, padding: '4px 0' }}>
                            None assigned
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {slots[r.key].map(s => (
                              <ShiftPill key={s.id} shift={s} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <details style={{ marginTop: 8 }}>
                      <summary style={{
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#d4a333',
                        userSelect: 'none',
                      }}>
                        + Assign someone
                      </summary>
                      <form action={addShift} style={{ marginTop: 10 }}>
                        <input type="hidden" name="shift_date" value={date} />
                        <input type="hidden" name="night" value={n.key} />

                        <div style={fieldLabel}>Role</div>
                        <select name="role" defaultValue="driver" required style={inputStyle}>
                          {ROLES.map(r => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </select>

                        <div style={fieldLabel}>From roster</div>
                        <select name="driver_id" defaultValue="" style={inputStyle}>
                          <option value="">— choose —</option>
                          {activeDrivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                          <option value="custom">Other (type below)</option>
                        </select>

                        <div style={fieldLabel}>Or name</div>
                        <input
                          type="text"
                          name="person_name"
                          placeholder="(optional if picked above)"
                          style={inputStyle}
                        />

                        <div style={fieldLabel}>Notes</div>
                        <input
                          type="text"
                          name="notes"
                          placeholder="(optional)"
                          style={inputStyle}
                        />

                        <button type="submit" style={submitButton}>
                          Add to {n.label}
                        </button>
                      </form>
                    </details>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

function ShiftPill({ shift }) {
  const style = ROLE_STYLE[shift.role] || ROLE_STYLE.driver
  return (
    <form action={deleteShift} style={{ margin: 0 }}>
      <input type="hidden" name="id" value={shift.id} />
      <button
        type="submit"
        title={shift.notes ? `${shift.notes}\n(click to remove)` : 'Click to remove'}
        style={{
          background: style.bg,
          color: style.fg,
          border: `1px solid ${style.border}`,
          fontFamily: FONT_BODY,
          fontSize: 12,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 999,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {shift.person_name}
        <span style={{ opacity: 0.6, fontSize: 11 }}>×</span>
      </button>
    </form>
  )
}

const fieldLabel = {
  color: '#9c9ca3',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  margin: '8px 0 4px 0',
}
const inputStyle = {
  background: '#0d0d10',
  border: '1px solid #2a2a31',
  color: '#e8e8ea',
  fontFamily: FONT_BODY,
  fontSize: 13,
  padding: '8px 10px',
  borderRadius: 6,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}
const submitButton = {
  background: '#d4a333',
  color: '#0a0a0b',
  border: 'none',
  fontFamily: FONT_BODY,
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  width: '100%',
  marginTop: 10,
}
