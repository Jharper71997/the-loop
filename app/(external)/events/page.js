import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ExternalNav from '../_components/ExternalNav'
import Footer from '../_components/Footer'
import PlaceholderArt from '../_components/PlaceholderArt'

export const metadata = {
  title: 'Upcoming Loops',
  description: 'Book a seat on an upcoming Jville Brew Loop shuttle night. $20 flat, any pickup bar.',
  alternates: { canonical: '/events' },
  openGraph: {
    title: 'Upcoming Loops',
    description: 'Pick a Friday or Saturday. $20 per seat covers your whole night on the Loop.',
    url: '/events',
  },
  twitter: {
    title: 'Upcoming Loops',
    description: 'Pick a Friday or Saturday. $20 per seat covers your whole night on the Loop.',
  },
}
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

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
    .limit(24)

  return (
    <>
      <ExternalNav />
      <main>
        <section
          style={{
            padding: '56px 20px 32px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'radial-gradient(700px 300px at 50% 0%, rgba(212,163,51,0.12), transparent 70%)',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Upcoming loops
            </div>
            <h1 style={{ color: INK }}>Pick a night. Grab a seat.</h1>
            <p style={{ marginTop: 14, fontSize: 16 }}>
              $20 covers your whole loop. Shuttle runs from ~7:30 PM to ~1:30 AM.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 72px' }}>
          {!events?.length ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 18,
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              }}
            >
              {events.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        border: '1px dashed rgba(255,255,255,0.12)',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.015)',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <div style={{ color: INK, fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
        No loops on sale yet
      </div>
      <p style={{ color: INK_DIM, margin: '0 0 20px' }}>
        Tickets typically drop early in the week. Follow us or check back soon.
      </p>
      <a href="/" style={ghostCta}>Back home</a>
    </div>
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
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.15s',
      }}
    >
      <div
        style={{
          aspectRatio: '16/9',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {event.cover_image_url ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: `url(${event.cover_image_url}) center/cover`,
            }}
          />
        ) : (
          <PlaceholderArt label="Brew Loop" />
        )}
        <span
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: GOLD,
            fontWeight: 700,
            background: 'rgba(10,10,11,0.75)',
            padding: '6px 12px',
            borderRadius: 999,
            backdropFilter: 'blur(6px)',
          }}
        >
          {formatDate(event.event_date)}
        </span>
        {event.pickup_time && (
          <span
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              fontSize: 12,
              fontWeight: 600,
              color: INK,
              background: 'rgba(10,10,11,0.75)',
              padding: '6px 12px',
              borderRadius: 999,
              backdropFilter: 'blur(6px)',
            }}
          >
            First pickup {formatTime(event.pickup_time)}
          </span>
        )}
      </div>

      <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h3 style={{ color: INK, fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{event.name}</h3>
        {event.description && (
          <p
            style={{
              color: INK_DIM,
              fontSize: 14,
              lineHeight: 1.55,
              margin: '0 0 16px',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.description}
          </p>
        )}

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ color: GOLD_HI, fontWeight: 700, fontSize: 16 }}>
            {fromPrice != null ? `From $${(fromPrice / 100).toFixed(0)}` : 'Book now'}
          </span>
          <span
            style={{
              color: INK,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Book <span style={{ color: GOLD }}>&rarr;</span>
          </span>
        </div>
      </div>
    </a>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
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

const ghostCta = {
  display: 'inline-block',
  padding: '12px 22px',
  borderRadius: 999,
  background: 'transparent',
  color: INK,
  border: '1px solid rgba(255,255,255,0.15)',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: 14,
}
