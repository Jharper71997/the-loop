import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const metadata = {
  title: 'Upcoming Loops — Jville Brew Loop',
  description: 'Book a seat on the Jville Brew Loop shuttle.',
}
export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const supabase = supabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const { data: events } = await supabase
    .from('events')
    .select(`
      id, name, event_date, pickup_time, description, cover_image_url, status, capacity,
      ticket_types ( price_cents, active )
    `)
    .eq('status', 'on_sale')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(12)

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    }}>
      {/* HUD hero */}
      <header style={{
        position: 'relative',
        padding: '48px 20px 32px',
        textAlign: 'center',
        borderBottom: '1px solid #1e1e23',
        background: 'radial-gradient(600px 300px at 50% 0%, rgba(212,163,51,0.12), transparent 70%)',
      }}>
        <div className="tag-status" style={{ justifyContent: 'center', display: 'inline-flex' }}>
          Upcoming loops
        </div>
        <h1 style={{
          fontFamily: "'Orbitron', system-ui, sans-serif",
          fontSize: 36,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          margin: '12px 0 6px',
          color: '#f5f5f7',
          textShadow: '0 0 22px rgba(212,163,51,0.3)',
        }}>Jville Brew Loop</h1>
        <p style={{ color: '#9c9ca3', fontSize: 14, maxWidth: 520, margin: '0 auto' }}>
          21+ bar-hop shuttle. Pick a night, grab a seat, let us drive.
        </p>
      </header>

      <section style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
        {!events?.length ? (
          <div className="card" style={{ textAlign: 'center', padding: 28 }}>
            <div className="stat-label">No loops on sale yet</div>
            <p className="muted" style={{ marginTop: 8 }}>
              Check back soon, or text us at <a href="tel:18448846175" style={{ color: '#d4a333' }}>(844) 884-6175</a>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {events.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </section>
    </main>
  )
}

function EventCard({ event }) {
  const prices = (event.ticket_types || [])
    .filter(t => t.active)
    .map(t => t.price_cents)
    .sort((a, b) => a - b)
  const fromPrice = prices[0]

  return (
    <a
      href={`/book/${event.id}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        background: 'linear-gradient(180deg, #121216, #0d0d10)',
        border: '1px solid #2a2a31',
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.2s',
      }}
    >
      {event.cover_image_url ? (
        <img
          src={event.cover_image_url}
          alt=""
          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%',
          aspectRatio: '16/9',
          background: 'radial-gradient(circle at 30% 30%, rgba(212,163,51,0.18), transparent 60%), #0e0e12',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          fontSize: 14,
          letterSpacing: '0.3em',
          color: '#d4a333',
          textTransform: 'uppercase',
        }}>
          Brew Loop
        </div>
      )}

      <div style={{ padding: 14 }}>
        <div className="tag-status" style={{ fontSize: 9 }}>
          {formatDate(event.event_date)}{event.pickup_time ? ` · ${formatTime(event.pickup_time)}` : ''}
        </div>
        <h3 style={{ margin: '8px 0 4px', fontSize: 17, color: '#f5f5f7' }}>{event.name}</h3>
        {event.description && (
          <p style={{
            color: '#9c9ca3',
            fontSize: 13,
            margin: '0 0 10px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>{event.description}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: '#d4a333',
            letterSpacing: '0.06em',
          }}>
            {fromPrice != null ? `FROM $${(fromPrice / 100).toFixed(0)}` : 'Book now'}
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#c8c8cc',
          }}>
            Book →
          </span>
        </div>
      </div>

      {/* Gold corner brackets */}
      <span style={cornerStyle('tl')} />
      <span style={cornerStyle('br')} />
    </a>
  )
}

function cornerStyle(pos) {
  const base = {
    position: 'absolute',
    width: 12,
    height: 12,
    border: '1px solid #d4a333',
    boxShadow: '0 0 8px rgba(212,163,51,0.35)',
    pointerEvents: 'none',
  }
  if (pos === 'tl') return { ...base, top: -1, left: -1, borderRight: 'none', borderBottom: 'none', borderTopLeftRadius: 10 }
  return { ...base, bottom: -1, right: -1, borderLeft: 'none', borderTop: 'none', borderBottomRightRadius: 10 }
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
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
