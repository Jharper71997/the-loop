import { getUpcomingLoops } from '@/lib/upcomingLoops'
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
  const loops = await getUpcomingLoops({ limit: 24 })

  return (
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
          {!loops.length ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 18,
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              }}
            >
              {loops.map(loop => <LoopCard key={`${loop.kind}-${loop.id}`} loop={loop} />)}
            </div>
          )}
        </section>
    </main>
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
        No loops scheduled yet
      </div>
      <p style={{ color: INK_DIM, margin: '0 0 20px' }}>
        New dates drop each week. Follow us or check back soon.
      </p>
      <a href="/" style={ghostCta}>Back home</a>
    </div>
  )
}

function LoopCard({ loop }) {
  const isBookable = loop.kind === 'event'
  const href = isBookable ? `/book/${loop.id}` : '#'

  return (
    <a
      href={href}
      onClick={isBookable ? undefined : (e) => e.preventDefault()}
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
        cursor: isBookable ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          aspectRatio: '16/9',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {loop.coverImageUrl ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: `url(${loop.coverImageUrl}) center/cover`,
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
          {formatDate(loop.eventDate)}
        </span>
        {!isBookable && (
          <span
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: GOLD_HI,
              fontWeight: 700,
              background: 'rgba(212,163,51,0.14)',
              border: '1px solid rgba(212,163,51,0.35)',
              padding: '4px 10px',
              borderRadius: 999,
            }}
          >
            Coming soon
          </span>
        )}
        {loop.pickupTime && (
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
            First pickup {formatTime(loop.pickupTime)}
          </span>
        )}
      </div>

      <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h3 style={{ color: INK, fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{loop.name}</h3>

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
            {isBookable
              ? (loop.fromPriceCents != null ? `From $${(loop.fromPriceCents / 100).toFixed(0)}` : 'Book now')
              : 'Tickets soon'}
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
            {isBookable ? (
              <>Book <span style={{ color: GOLD }}>&rarr;</span></>
            ) : (
              <span style={{ color: INK_DIM }}>Not on sale</span>
            )}
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
