import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Book the Brew Loop',
  description: 'Reserve your seat on the Jville Brew Loop shuttle.',
}

export default async function BookListPage() {
  const supabase = supabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, pickup_time, description, status, cover_image_url')
    .gte('event_date', today)
    .eq('status', 'on_sale')
    .order('event_date', { ascending: true })

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ color: '#d4a333', fontSize: 28, margin: '8px 0 4px' }}>Upcoming Loops</h1>
        <p style={{ color: '#9c9ca3', fontSize: 14, margin: '0 0 24px' }}>
          Pick a night to ride the Brew Loop.
        </p>

        {(!events || events.length === 0) && (
          <div style={{
            padding: 24,
            background: '#15151a',
            border: '1px solid #2a2a31',
            borderRadius: 12,
            color: '#bbb',
          }}>
            No events on sale right now. Check back soon, or follow us on social for the next drop.
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {(events || []).map(ev => (
            <li key={ev.id}>
              <a
                href={`/book/${ev.id}`}
                style={{
                  display: 'block',
                  padding: 16,
                  background: '#15151a',
                  border: '1px solid #2a2a31',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: '#fff',
                }}
              >
                <div style={{ color: '#d4a333', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {formatDate(ev.event_date)}{ev.pickup_time ? ` · ${formatTime(ev.pickup_time)}` : ''}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{ev.name}</div>
                {ev.description && (
                  <div style={{ marginTop: 6, fontSize: 13, color: '#bbb' }}>{ev.description}</div>
                )}
                <div style={{ marginTop: 10, color: '#d4a333', fontSize: 13, fontWeight: 600 }}>
                  Reserve →
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

function Header() {
  return (
    <header style={{
      padding: '12px 16px',
      background: '#0a0a0b',
      borderBottom: '2px solid #d4a333',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span style={{ color: '#d4a333', fontSize: 18, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Jville Brew Loop
        </span>
        <span style={{ color: '#bbb', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Reserve Your Seat
        </span>
      </div>
      <a href="/track" style={{
        color: '#d4a333',
        fontSize: 12,
        textDecoration: 'none',
        border: '1px solid #d4a333',
        padding: '6px 10px',
        borderRadius: 6,
      }}>
        Live Shuttle →
      </a>
    </header>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
