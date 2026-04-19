import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { todayInTZ, formatStopTime } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

export default async function TonightPage() {
  const supabase = supabaseAdmin()
  const today = todayInTZ()

  const [
    { data: groups },
    { data: orders },
    { data: contactsCount },
  ] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, event_date, pickup_time, schedule, group_members(id, current_stop_index, contacts(id, first_name, last_name, phone))')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(3),
    supabase
      .from('orders')
      .select('id, buyer_name, buyer_phone, total_cents, status, party_size, created_at, paid_at, events(name, event_date)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true }),
  ])

  const tonight = (groups || []).find(g => g.event_date === today) || (groups || [])[0]
  const upcoming = (groups || []).filter(g => g.id !== tonight?.id)

  const stops = Array.isArray(tonight?.schedule) ? tonight.schedule : []
  const ridersByStop = stops.map((s, i) => ({
    name: s.name,
    start_time: s.start_time,
    riders: (tonight?.group_members || []).filter(m => m.current_stop_index === i),
  }))
  const unassigned = (tonight?.group_members || []).filter(m => m.current_stop_index == null || m.current_stop_index < 0)

  const totalRiders = tonight?.group_members?.length || 0
  const paidToday = (orders || [])
    .filter(o => o.status === 'paid' && o.events?.event_date === today)
    .reduce((s, o) => s + (o.total_cents || 0), 0)

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', minHeight: '100vh', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, color: ACCENT, margin: 0 }}>Tonight</h1>
        <span style={{ color: '#9c9ca3', fontSize: 13 }}>{formatToday(today)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
        <Stat label="Riders booked" value={totalRiders} />
        <Stat label="Today's revenue" value={`$${(paidToday / 100).toFixed(0)}`} />
        <Stat label="Total contacts" value={contactsCount?.length ?? '—'} />
        <Stat label="Pickup time" value={tonight?.pickup_time ? formatStopTime(tonight.pickup_time) : '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14 }}>
        <Card title={tonight ? `Manifest — ${tonight.name}` : 'No Loop scheduled tonight'}>
          {!tonight && (
            <p style={{ color: '#9c9ca3', margin: 0 }}>
              Create one from the <a href="/groups" style={{ color: ACCENT }}>Loops</a> tab.
            </p>
          )}
          {tonight && stops.length === 0 && (
            <p style={{ color: '#9c9ca3', margin: 0 }}>
              No schedule set yet. Open the Loop to add stops.
            </p>
          )}
          {tonight && stops.length > 0 && (
            <div style={{ display: 'grid', gap: 10 }}>
              {ridersByStop.map((s, i) => (
                <div key={i} style={{ padding: 10, background: '#0e0e12', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ color: ACCENT, fontSize: 13 }}>
                      {i + 1}. {s.name}
                    </strong>
                    <span style={{ color: '#9c9ca3', fontSize: 11 }}>{formatStopTime(s.start_time)}</span>
                  </div>
                  {s.riders.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#6f6f76', marginTop: 4 }}>No riders here</div>
                  ) : (
                    <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                      {s.riders.map(r => (
                        <li key={r.id} style={{ fontSize: 13 }}>
                          {r.contacts?.first_name} {r.contacts?.last_name}
                          {r.contacts?.phone && (
                            <span style={{ color: '#9c9ca3', fontSize: 11, marginLeft: 6 }}>{r.contacts.phone}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {unassigned.length > 0 && (
                <div style={{ padding: 10, background: '#0e0e12', borderRadius: 8, border: `1px dashed ${BORDER}` }}>
                  <strong style={{ color: '#facc15', fontSize: 13 }}>Unassigned ({unassigned.length})</strong>
                  <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                    {unassigned.map(r => (
                      <li key={r.id} style={{ fontSize: 13 }}>
                        {r.contacts?.first_name} {r.contacts?.last_name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>

        <div style={{ display: 'grid', gap: 14 }}>
          <Card title="Live shuttle">
            <a href="/track" style={{
              display: 'block',
              padding: '24px 12px',
              background: '#0e0e12',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              textAlign: 'center',
              textDecoration: 'none',
              color: ACCENT,
              fontWeight: 700,
            }}>
              Open tracker →
            </a>
          </Card>

          <Card title="Recent orders">
            {(orders || []).length === 0 && (
              <p style={{ color: '#9c9ca3', margin: 0, fontSize: 13 }}>No orders yet.</p>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {(orders || []).map(o => (
                <div key={o.id} style={{ padding: 8, background: '#0e0e12', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{o.buyer_name || '(no name)'}</strong>
                    <span style={{ color: ACCENT }}>${(o.total_cents / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ color: '#9c9ca3', fontSize: 11, marginTop: 2 }}>
                    {o.events?.name || '—'} · {o.party_size} ticket{o.party_size === 1 ? '' : 's'} · {o.status}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {upcoming.length > 0 && (
            <Card title="Upcoming Loops">
              <div style={{ display: 'grid', gap: 6 }}>
                {upcoming.map(g => (
                  <a key={g.id} href={`/groups#${g.id}`} style={{
                    padding: 8, background: '#0e0e12', borderRadius: 6, fontSize: 13,
                    textDecoration: 'none', color: '#fff', display: 'block',
                  }}>
                    <div style={{ color: ACCENT, fontSize: 11 }}>{g.event_date}</div>
                    <div>{g.name}</div>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#9c9ca3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
      <h2 style={{ fontSize: 12, color: ACCENT, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
      {children}
    </section>
  )
}

function formatToday(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}
