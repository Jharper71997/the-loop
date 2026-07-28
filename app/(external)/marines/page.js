// The Loop (Marines) — rider landing, built on the StoryBrand BrandScript.
//   Hero        = a Marine who needs to get around town without a car.
//   Guide       = The Loop (built for Marines, verified-only, driver checks IDs).
//   Plan        = 3 steps: verify once → grab a ride → board at the gate.
//   CTA         = "Verify to ride".  Stakes = stuck/stranded/overpaying.
//   Success     = cheap, easy way around Jacksonville and back to base.
// This is a SHUTTLE for Marines, NOT a bar crawl — no drinking framing.

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const LINE = 'rgba(255,255,255,0.08)'
const SURFACE = '#15151a'
const BG_GLOW = 'radial-gradient(120% 80% at 50% 0%, rgba(212,163,51,0.20), transparent 60%), #121216'

export const metadata = {
  title: { absolute: 'The Loop — a shuttle for Marines' },
  description: 'The Loop is a shuttle for Marines at Camp Lejeune. Board at the gate, ride the loop around town. $10 a ride or a $20 day pass. Verify once with your DoD ID.',
  alternates: { canonical: '/marines' },
}

export const dynamic = 'force-dynamic'

const STEPS = [
  ['Verify you’re a Marine', 'Enter your 10-digit DoD ID once. That’s it — you’re cleared to ride.'],
  ['Grab a ride', 'Single ride is $10, or a $20 day pass to hop on and off all day.'],
  ['Board at the gate', 'Catch The Loop at the on-base stop and ride the loop around town.'],
]

const PASSES = [
  { name: 'Single Ride', price: '$10', note: 'One boarding. Ride to your stop and hop off.' },
  { name: 'Day Pass', price: '$20', note: 'Hop on and off all day, as many loops as you want.', featured: true },
]

export default function MarinesLanding() {
  return (
    <main style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>

        {/* Hero — character + what they get, plain and direct */}
        <section style={{ ...card, borderRadius: 18, position: 'relative', overflow: 'hidden', padding: '28px 22px 24px', background: BG_GLOW, boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
          <div aria-hidden style={{ position: 'absolute', right: -40, bottom: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(212,163,51,0.18), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, boxShadow: `0 0 10px ${GOLD}`, display: 'inline-block' }} />
            For Marines at Camp Lejeune
          </div>
          <h1 style={{ position: 'relative', color: INK, fontSize: 32, fontWeight: 800, margin: '10px 0 8px', letterSpacing: '-0.015em', lineHeight: 1.06 }}>
            Get around town. No car required.
          </h1>
          <p style={{ position: 'relative', color: INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
            The Loop is a shuttle built for Marines. Board at the gate, ride a fixed loop to stops
            around Jacksonville, and hop off where you need to be. Ten bucks a ride, or a $20 day pass.
          </p>
          <div style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <a href="/marines/events" style={primaryCta}>Get a ride</a>
            <a href="/marines/track" style={ghostCta}>See it live</a>
          </div>
          <div style={{ position: 'relative', color: INK_DIM, fontSize: 12, marginTop: 12 }}>
            Marines only. You verify once with your DoD ID, and the driver checks your card at the door.
          </div>
        </section>

        {/* Plan — 3 simple steps */}
        <section>
          <div style={sectionLabel}>How it works</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {STEPS.map(([title, body], i) => (
              <div key={title} style={{ ...softCard, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={stepNum}>{i + 1}</span>
                <div>
                  <div style={{ color: INK, fontSize: 15, fontWeight: 700 }}>{title}</div>
                  <div style={{ color: INK_DIM, fontSize: 13.5, marginTop: 2, lineHeight: 1.45 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fares */}
        <section>
          <div style={sectionLabel}>Fares</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {PASSES.map(p => (
              <div key={p.name} style={{ ...softCard, padding: '16px 14px',
                border: `1px solid ${p.featured ? 'rgba(212,163,51,0.5)' : LINE}`,
                background: p.featured ? 'rgba(212,163,51,0.10)' : SURFACE,
                boxShadow: p.featured ? '0 14px 30px rgba(212,163,51,0.16)' : '0 14px 30px rgba(0,0,0,0.22)' }}>
                <div style={{ color: p.featured ? GOLD_HI : INK, fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                <div style={{ color: GOLD_HI, fontSize: 24, fontWeight: 800, margin: '4px 0 6px' }}>{p.price}</div>
                <div style={{ color: INK_DIM, fontSize: 12.5, lineHeight: 1.4 }}>{p.note}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Route */}
        <section style={{ ...softCard, padding: '16px 16px' }}>
          <div style={sectionLabel}>The route</div>
          <p style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            The Loop starts at the on-base gate and runs a fixed loop of stops around town. Check the
            live map for this weekend&rsquo;s stops and where the shuttle is right now.
          </p>
          <div style={{ marginTop: 12 }}>
            <a href="/marines/track" style={ghostCta}>See the live map</a>
          </div>
        </section>

        {/* Close — stakes + CTA */}
        <section style={{ ...softCard, padding: '22px 18px', textAlign: 'center', background: BG_GLOW }}>
          <div style={{ color: INK, fontSize: 17, fontWeight: 800 }}>Done being stuck on base?</div>
          <div style={{ color: INK_DIM, fontSize: 13.5, margin: '6px 0 14px' }}>
            Grab the next loop. Verify once with your DoD ID and you&rsquo;re cleared for every ride.
          </div>
          <a href="/marines/events" style={primaryCta}>Get a ride</a>
        </section>

      </div>
    </main>
  )
}

const card = { background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16 }
const softCard = { ...card, boxShadow: '0 14px 30px rgba(0,0,0,0.22)' }
const eyebrow = { color: GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }
const sectionLabel = { color: GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, paddingLeft: 2 }
const stepNum = { flex: '0 0 auto', width: 26, height: 26, borderRadius: 7, border: `1px solid ${GOLD}`, color: GOLD_HI, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const primaryCta = { display: 'inline-block', padding: '13px 22px', borderRadius: 12, background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 10px 30px rgba(212,163,51,0.25)' }
const ghostCta = { display: 'inline-block', padding: '13px 20px', borderRadius: 12, background: 'transparent', color: INK, border: `1px solid ${LINE}`, fontWeight: 700, fontSize: 14, textDecoration: 'none' }
