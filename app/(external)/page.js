import { getUpcomingLoops } from '@/lib/upcomingLoops'
import ExternalNav from './_components/ExternalNav'
import Footer from './_components/Footer'
import PlaceholderArt from './_components/PlaceholderArt'

export const metadata = {
  title: { absolute: 'Jville Brew Loop — Jacksonville\'s weekend bar-hop shuttle' },
  description: 'Hop between partner bars every Friday and Saturday night in Jacksonville. Book a seat, track the shuttle live, and ride safe.',
  alternates: { canonical: '/' },
}
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default async function LandingPage() {
  const loops = await getUpcomingLoops({ limit: 3 })

  return (
    <>
      <ExternalNav />
      <main>
        <Hero />
        <NextLoops loops={loops} />
        <HowItWorks />
      </main>
      <Footer />
    </>
  )
}

function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        padding: '64px 20px 56px',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(900px 500px at 50% -10%, rgba(212,163,51,0.16), transparent 70%)',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto', textAlign: 'center', zIndex: 1 }}>
        <h1 style={{ margin: '0 auto' }}>
          The weekend shuttle that drives,{' '}
          <span style={{
            background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>so you don&apos;t have to.</span>
        </h1>

        <p style={{ margin: '18px auto 0', maxWidth: 520, fontSize: 17 }}>
          $20 a seat. One ticket, all night. Fri &amp; Sat in Jacksonville.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <a href="/events" style={primaryCta}>See upcoming loops</a>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Book online',
      body: 'Pick a night, sign your waiver, and pay — all in one flow.',
    },
    {
      n: '2',
      title: 'Ride the route',
      body: '~1 h 15 min per bar. A text lands 10 min before we roll so you can close your tab.',
    },
    {
      n: '3',
      title: 'Get home safe',
      body: 'Track the shuttle live. We drive so you don&apos;t have to.',
    },
  ]

  return (
    <section id="how-it-works" style={{ padding: '48px 20px 72px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
        <div
          style={{
            color: GOLD,
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          How it works
        </div>
        <h2 style={{ color: INK, textAlign: 'center', fontSize: 26 }}>Three steps. Done.</h2>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          marginTop: 28,
        }}
      >
        {steps.map(s => (
          <div
            key={s.n}
            style={{
              padding: '20px 20px 18px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(212,163,51,0.15)',
                border: `1px solid ${GOLD}`,
                color: GOLD_HI,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {s.n}
            </div>
            <h3 style={{ color: INK, fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{s.title}</h3>
            <p
              style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, margin: 0 }}
              dangerouslySetInnerHTML={{ __html: s.body }}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHeader({ eyebrow, title, sub }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
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
        {eyebrow}
      </div>
      <h2 style={{ color: INK, textAlign: 'center' }}>{title}</h2>
      {sub && <p style={{ marginTop: 12 }}>{sub}</p>}
    </div>
  )
}

function NextLoops({ loops }) {
  return (
    <section style={{ padding: '32px 20px 72px', maxWidth: 1100, margin: '0 auto' }}>
      <SectionHeader
        eyebrow="Next loops"
        title="What&apos;s rolling this weekend."
      />

      {loops.length === 0 ? (
        <div
          style={{
            marginTop: 32,
            padding: '40px 24px',
            textAlign: 'center',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <div style={{ color: INK, fontWeight: 600, marginBottom: 6 }}>No loops scheduled yet.</div>
          <p style={{ color: INK_DIM, margin: 0 }}>Check back soon, or follow us to hear when tickets drop.</p>
        </div>
      ) : (
        <div
          style={{
            marginTop: 32,
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          {loops.map(loop => <MiniLoopCard key={`${loop.kind}-${loop.id}`} loop={loop} />)}
        </div>
      )}

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <a href="/events" style={ghostCta}>See all loops &rarr;</a>
      </div>
    </section>
  )
}

function MiniLoopCard({ loop }) {
  const isBookable = loop.kind === 'event'
  const href = isBookable ? `/book/${loop.id}` : '/events'

  return (
    <a
      href={href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'transform 0.2s, border-color 0.2s',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16/9',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 14,
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
            position: 'relative',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: GOLD,
            fontWeight: 600,
            background: 'rgba(10,10,11,0.7)',
            padding: '4px 10px',
            borderRadius: 999,
            backdropFilter: 'blur(6px)',
          }}
        >
          {formatDate(loop.eventDate)}
          {loop.pickupTime ? ` · ${formatTime(loop.pickupTime)}` : ''}
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
      </div>
      <div style={{ padding: '18px 18px 20px' }}>
        <h3 style={{ color: INK, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{loop.name}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
          <span style={{ color: GOLD_HI, fontWeight: 700, fontSize: 15 }}>
            {isBookable
              ? (loop.fromPriceCents != null ? `From $${(loop.fromPriceCents / 100).toFixed(0)}` : 'Book now')
              : 'Tickets soon'}
          </span>
          <span style={{ color: INK_DIM, fontSize: 13, fontWeight: 500 }}>
            {isBookable ? 'Book →' : 'Details →'}
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

const primaryCta = {
  display: 'inline-block',
  padding: '14px 26px',
  borderRadius: 999,
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
  color: '#0a0a0b',
  fontWeight: 700,
  textDecoration: 'none',
  fontSize: 15,
  boxShadow: '0 10px 30px rgba(212,163,51,0.3)',
}

const ghostCta = {
  display: 'inline-block',
  padding: '14px 26px',
  borderRadius: 999,
  background: 'transparent',
  color: INK,
  border: '1px solid rgba(255,255,255,0.15)',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: 15,
}
