import ExternalNav from '../_components/ExternalNav'
import Footer from '../_components/Footer'

export const metadata = {
  title: 'About',
  description: 'Why we built the Jville Brew Loop, how a night runs, and how to partner with us.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About the Jville Brew Loop',
    description: 'Why we built the Loop, how a night runs, and how to partner with us.',
    url: '/about',
  },
  twitter: {
    title: 'About the Jville Brew Loop',
    description: 'Why we built the Loop, how a night runs, and how to partner with us.',
  },
}

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default function AboutPage() {
  return (
    <>
      <ExternalNav />
      <main>
        <section style={{ padding: '56px 20px 24px', maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
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
            About
          </div>
          <h1 style={{ color: INK }}>The Brew Loop, end to end.</h1>
          <p style={{ marginTop: 14, fontSize: 16 }}>
            Why we built it, how a night runs, and how to get on board.
          </p>
        </section>

        <Mission />
        <HowItWorksFull />
        <Faq />
        <SponsorStrip />
      </main>
      <Footer />
    </>
  )
}

function Mission() {
  return (
    <section
      style={{
        padding: '56px 20px',
        background: 'linear-gradient(180deg, transparent, rgba(212,163,51,0.03), transparent)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            color: GOLD,
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          Why we built it
        </div>
        <h2 style={{ color: INK }}>
          Jacksonville deserved a better ride home.
        </h2>
        <p style={{ marginTop: 16, fontSize: 17 }}>
          Rideshare after a few drinks is expensive and unpredictable. Driving after a few drinks is a line nobody should
          cross. The Brew Loop is a flat-rate, scheduled shuttle that takes the decision off the table.
        </p>
        <p style={{ marginTop: 14, fontSize: 17 }}>
          Book once, ride all night, get home safe.
        </p>
      </div>
    </section>
  )
}

function HowItWorksFull() {
  const steps = [
    {
      n: '01',
      title: 'Book your seat',
      body: '$20 covers your whole night on the Loop. Sign your waiver inline, pay, done.',
    },
    {
      n: '02',
      title: 'Meet the shuttle',
      body: 'Pickups start around 7:30 PM. You&apos;ll get an SMS with the exact time and spot.',
    },
    {
      n: '03',
      title: 'Ride the route',
      body: '~1 hour 15 minutes at each bar. A text lands 10 minutes before we roll, so you can close your tab.',
    },
    {
      n: '04',
      title: 'Track it live',
      body: 'See the shuttle on the map all night. Never wonder when it&apos;s coming back.',
    },
  ]

  return (
    <section style={{ padding: '72px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
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
          How a night runs
        </div>
        <h2 style={{ color: INK, textAlign: 'center' }}>A real plan for a safe night out.</h2>
        <p style={{ marginTop: 12 }}>
          Not hop-on / hop-off. A tracked, scheduled route with your bar-hopping built in.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          marginTop: 32,
        }}
      >
        {steps.map(s => (
          <div
            key={s.n}
            style={{
              padding: '22px 22px 20px',
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

function Faq() {
  const items = [
    {
      q: 'How much is a ticket?',
      a: '$20 per seat. One ticket covers your whole night on the Loop.',
    },
    {
      q: 'How long are we at each bar?',
      a: 'About 1 hour 15 minutes per stop. It&rsquo;s a tracked, scheduled route, not hop-on / hop-off.',
    },
    {
      q: 'How will I know when the shuttle is leaving?',
      a: 'You&rsquo;ll get a text roughly 10 minutes before the shuttle rolls, so you can close your tab and finish your drink.',
    },
    {
      q: 'Can I see where the bus is?',
      a: 'Yes. The <a href="/track" style="color:#d4a333;text-decoration:none;font-weight:600">live map</a> shows the shuttle in real time once the night kicks off.',
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
      q: 'We have a group of 5 or more &mdash; can you pick us up somewhere?',
      a: 'On request, availability-dependent. <a href="mailto:hello@jvillebrewloop.com" style="color:#d4a333;text-decoration:none;font-weight:600">Email us</a> the date, party size, and where you&rsquo;re starting and we&rsquo;ll see if we can line it up.',
    },
    {
      q: 'Which bars are on the route?',
      a: 'Eight partner bars around Jacksonville rotate weekend to weekend &mdash; and Friday&rsquo;s route can differ from Saturday&rsquo;s. Check the <a href="/events" style="color:#d4a333;text-decoration:none;font-weight:600">event page</a> for exact stops on the night you book.',
    },
  ]

  return (
    <section style={{ padding: '56px 20px 72px', maxWidth: 820, margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
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
          FAQ
        </div>
        <h2 style={{ color: INK, textAlign: 'center' }}>Questions riders ask.</h2>
      </div>
      <div style={{ marginTop: 28, display: 'grid', gap: 10 }}>
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
              dangerouslySetInnerHTML={{ __html: `<span>${it.q}</span><span aria-hidden style="color:${GOLD};font-size:20px;line-height:1">+</span>` }}
            />
            <div
              style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.65, marginTop: 12 }}
              dangerouslySetInnerHTML={{ __html: it.a }}
            />
          </details>
        ))}
      </div>
    </section>
  )
}

function SponsorStrip() {
  return (
    <section style={{ padding: '32px 20px 72px', maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
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
          Partners &amp; sponsors
        </div>
        <h3 style={{ color: INK, fontSize: 22, fontWeight: 600, margin: 0 }}>
          Want your brand on the shuttle every weekend?
        </h3>
        <p style={{ color: INK_DIM, maxWidth: 560, margin: 0 }}>
          Bars, breweries, and local businesses ride with us. Sponsor a weekend, host a pickup, or get on the shuttle wrap.
        </p>
        <a
          href="mailto:richard@jvillebrewloop.com"
          style={{
            display: 'inline-block',
            padding: '14px 26px',
            borderRadius: 999,
            background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
            color: '#0a0a0b',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: 15,
            boxShadow: '0 10px 30px rgba(212,163,51,0.3)',
          }}
        >
          Get the partner pack
        </a>
      </div>
    </section>
  )
}
