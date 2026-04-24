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
const INK_MUTED = '#8a8a90'

export default async function LandingPage() {
  const loops = await getUpcomingLoops({ limit: 3 })

  return (
    <>
      <ExternalNav />
      <main>
        <Hero />
        <HowItWorks />
        <NextLoops loops={loops} />
        <Mission />
        <Faq />
        <SponsorStrip />
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
        padding: '72px 20px 80px',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 500px at 50% -10%, rgba(212,163,51,0.18), transparent 70%),' +
            'radial-gradient(600px 400px at 80% 100%, rgba(212,163,51,0.08), transparent 70%)',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', textAlign: 'center', zIndex: 1 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'rgba(212,163,51,0.1)',
            border: `1px solid rgba(212,163,51,0.3)`,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: GOLD,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: GOLD,
            boxShadow: `0 0 8px ${GOLD}`,
          }} />
          Fri & Sat nights in Jacksonville
        </div>

        <h1 style={{ margin: '0 auto', maxWidth: 780 }}>
          The weekend shuttle that drives,{' '}
          <span style={{
            background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>so you don&apos;t have to.</span>
        </h1>

        <p style={{ margin: '20px auto 0', maxWidth: 600, fontSize: 17 }}>
          Hop between Jacksonville&apos;s best bars on a tracked route every Friday and Saturday.
          $20 a seat. One ticket, all night.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
          <a href="/events" style={primaryCta}>See this weekend&apos;s loops</a>
          <a href="/track" style={ghostCta}>Track a live ride</a>
        </div>

        <div style={{ marginTop: 40, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', color: INK_MUTED, fontSize: 13 }}>
          <Stat label="Per seat" value="$20" />
          <Dot />
          <Stat label="Partner bars" value="8" />
          <Dot />
          <Stat label="First pickup" value="7:30 PM" />
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
      <span style={{ color: GOLD_HI, fontWeight: 700, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: INK_MUTED }}>{label}</span>
    </span>
  )
}

function Dot() {
  return <span style={{ color: INK_MUTED, fontSize: 20, lineHeight: 1 }}>&middot;</span>
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Book your seat',
      body: 'Grab a ticket for Friday or Saturday. $20 covers your whole night on the Loop.',
    },
    {
      n: '02',
      title: 'Meet the shuttle',
      body: 'Pickups start around 7:30 PM. You&apos;ll get an SMS with the exact time and spot.',
    },
    {
      n: '03',
      title: 'Ride the route',
      body: '~1 hour 15 minutes at each bar. A text lands 10 minutes before the shuttle rolls, so you can close your tab.',
    },
    {
      n: '04',
      title: 'Track it live',
      body: 'See the shuttle on the map all night. Never wonder when it&apos;s coming back.',
    },
  ]

  return (
    <section id="how-it-works" style={{ padding: '72px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <SectionHeader
        eyebrow="How it works"
        title="A real plan for a safe night out."
        sub="Not hop-on / hop-off. A tracked, scheduled route with your bar-hopping built in."
      />

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          marginTop: 32,
        }}
      >
        {steps.map(s => (
          <div
            key={s.n}
            style={{
              position: 'relative',
              padding: '24px 22px 22px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14,
            }}
          >
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                letterSpacing: '0.2em',
                color: GOLD,
                marginBottom: 12,
                fontWeight: 600,
              }}
            >
              {s.n}
            </div>
            <h3 style={{ color: INK, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{s.title}</h3>
            <p
              style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.6 }}
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

function Mission() {
  return (
    <section
      style={{
        padding: '80px 20px',
        background: 'linear-gradient(180deg, transparent, rgba(212,163,51,0.03), transparent)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            color: GOLD,
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Why we built it
        </div>
        <h2 style={{ color: INK }}>
          Jacksonville deserved a better ride home.
        </h2>
        <p style={{ marginTop: 18, fontSize: 17 }}>
          Rideshare after a few drinks is expensive and unpredictable. Driving after a few drinks is a line nobody should
          cross. The Brew Loop is a flat-rate, scheduled shuttle that takes the decision off the table.
        </p>
        <p style={{ marginTop: 16, fontSize: 17 }}>
          Book once, ride all night, get home safe.
        </p>
      </div>
    </section>
  )
}

function Faq() {
  const items = [
    {
      q: 'How much is a ticket?',
      a: '$20 per seat. One ticket covers your whole night on the Loop.',
    },
    {
      q: 'How long are we at each bar?',
      a: 'About 1 hour 15 minutes per stop. It’s a tracked, scheduled route, not hop-on / hop-off.',
    },
    {
      q: 'How will I know when the shuttle is leaving?',
      a: 'You’ll get a text roughly 10 minutes before the shuttle rolls, so you can close your tab and finish your drink.',
    },
    {
      q: 'Can I see where the bus is?',
      a: (
        <>
          Yes. The <a href="/track" style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>live map</a> shows the shuttle in real time once the night kicks off.
        </>
      ),
    },
    {
      q: 'What time does it run?',
      a: 'First pickup is around 7:30 PM and we wrap up around 1:30 AM.',
    },
    {
      q: 'Do I have to be 21?',
      a: 'Yes. The Loop is strictly 21+.',
    },
    {
      q: 'We have a group of 5 or more — can you pick us up somewhere?',
      a: (
        <>
          On request, availability-dependent. <a href="mailto:hello@jvillebrewloop.com" style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>Email us</a> the date, party size, and where you&apos;re starting and we&apos;ll see if we can line it up.
        </>
      ),
    },
    {
      q: 'Which bars are on the route?',
      a: (
        <>
          Eight partner bars around Jacksonville rotate weekend to weekend — and Friday’s route can differ from Saturday’s. Check the{' '}
          <a href="/events" style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>event page</a> for exact stops on the night you book.
        </>
      ),
    },
  ]

  return (
    <section style={{ padding: '72px 20px', maxWidth: 820, margin: '0 auto' }}>
      <SectionHeader
        eyebrow="FAQ"
        title="Questions riders ask."
      />
      <div style={{ marginTop: 32, display: 'grid', gap: 10 }}>
        {items.map((it, i) => (
          <details
            key={i}
            style={{
              padding: '18px 20px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                listStyle: 'none',
                color: INK,
                fontWeight: 600,
                fontSize: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <span>{it.q}</span>
              <span aria-hidden style={{ color: GOLD, fontSize: 20, lineHeight: 1, transition: 'transform 0.2s' }}>+</span>
            </summary>
            <div style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.65, marginTop: 12 }}>{it.a}</div>
          </details>
        ))}
      </div>
    </section>
  )
}

function SponsorStrip() {
  return (
    <section style={{ padding: '56px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          padding: '36px 24px',
          background: 'linear-gradient(180deg, rgba(212,163,51,0.05), transparent)',
          border: '1px solid rgba(212,163,51,0.2)',
          borderRadius: 18,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: GOLD,
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          Partners & sponsors
        </div>
        <h3 style={{ color: INK, fontSize: 22, fontWeight: 600, margin: 0 }}>
          Want your brand on the shuttle every weekend?
        </h3>
        <p style={{ color: INK_DIM, maxWidth: 560, margin: 0 }}>
          Bars, breweries, and local businesses ride with us. Sponsor a weekend, host a pickup, or get on the shuttle wrap.
        </p>
        <a href="mailto:richard@jvillebrewloop.com" style={primaryCta}>Get the partner pack</a>
      </div>
    </section>
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
