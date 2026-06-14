// The Loop — rider-facing landing (Phase 1 scaffold).
// A hop-on/off shuttle for Camp Lejeune (all ages, military only). Standalone
// identity — NOT Brew Loop branded. Prices, stops, schedule are placeholders
// pending Jacob + Stephen. See OneDrive/Desktop/Marines-Loop-How-It-Works.md.

export const metadata = {
  title: { absolute: 'The Loop — Camp Lejeune shuttle' },
  description: 'Hop on, hop off to local spots all weekend. Camp Lejeune, Friday to Sunday, 9 to 5.',
  alternates: { canonical: '/marines' },
}

const BG_GLOW = 'radial-gradient(120% 80% at 50% 0%, rgba(138,154,79,0.20), transparent 60%), #1a2027'
const INK = '#eef1f3'
const INK_DIM = '#9aa3ab'
const OLIVE = '#8a9a4f'
const OLIVE_HI = '#aebb6a'
const SAND = '#c8b88f'
const SURFACE = '#1a2027'
const LINE = 'rgba(255,255,255,0.10)'

const PASSES = [
  { name: 'Single Ride', price: 'TBD', note: 'One boarding. Hop off where you want.' },
  { name: 'Day Pass', price: 'TBD', note: 'Unlimited hop-on, hop-off all day. The easy one.', featured: true },
  { name: 'Monthly Pass', price: 'TBD', note: 'Ride all month. For regulars who skip the car.' },
  { name: 'Sponsor Comped', price: 'Free', note: 'Some stops cover your ride. Look for the badge.' },
]

const STEPS = [
  ['Verify once', 'Confirm your military ID. One time, then you are cleared to ride.'],
  ['Grab a pass', 'Pick a single ride, a day pass, or go monthly.'],
  ['Hop on at the gate', 'Catch the shuttle at the base stop. Friday to Sunday, 9 to 5.'],
  ['Hop off anywhere', 'Stop at any spot on the route, then hop back on the next loop.'],
  ['Ride all day', 'Ride as many loops as you want while we are running.'],
]

export default function LoopLanding() {
  return (
    <main style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>

        {/* Hero */}
        <section style={{ ...card, position: 'relative', overflow: 'hidden', padding: '26px 20px 22px', background: BG_GLOW }}>
          <div style={eyebrow}>Camp Lejeune · Fri to Sun</div>
          <h1 style={{ color: INK, fontSize: 30, fontWeight: 900, margin: '8px 0 8px', letterSpacing: '-0.01em', lineHeight: 1.08 }}>
            Hop around town all weekend.
          </h1>
          <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.5, margin: 0 }}>
            The Loop is a hop-on, hop-off shuttle for Camp Lejeune, running our partner spots Friday,
            Saturday, and Sunday from 9 to 5. Catch it at the gate, ride all day, no car needed.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <a href="/marines/verify" style={primaryCta}>Verify to ride</a>
            <a href="/marines/track" style={ghostCta}>See it live</a>
          </div>
          <div style={{ color: INK_DIM, fontSize: 12, marginTop: 12 }}>Military ID required. You only verify once.</div>
        </section>

        {/* How it works */}
        <section>
          <div style={sectionLabel}>How it works</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {STEPS.map(([title, body], i) => (
              <div key={title} style={{ ...card, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={stepNum}>{i + 1}</span>
                <div>
                  <div style={{ color: INK, fontSize: 15, fontWeight: 700 }}>{title}</div>
                  <div style={{ color: INK_DIM, fontSize: 13.5, marginTop: 2, lineHeight: 1.45 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Passes */}
        <section>
          <div style={sectionLabel}>Passes</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {PASSES.map(p => (
              <div key={p.name} style={{ ...card, padding: '14px 14px',
                border: `1px solid ${p.featured ? 'rgba(138,154,79,0.5)' : LINE}`,
                background: p.featured ? 'rgba(138,154,79,0.10)' : SURFACE }}>
                <div style={{ color: p.featured ? OLIVE_HI : INK, fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                <div style={{ color: SAND, fontSize: 20, fontWeight: 800, margin: '4px 0 6px' }}>{p.price}</div>
                <div style={{ color: INK_DIM, fontSize: 12.5, lineHeight: 1.4 }}>{p.note}</div>
              </div>
            ))}
          </div>
          <div style={{ color: INK_DIM, fontSize: 12, marginTop: 8 }}>
            Pricing is being finalized. Verify now and you will be first to ride.
          </div>
        </section>

        {/* Route */}
        <section style={{ ...card, padding: '16px 16px' }}>
          <div style={sectionLabel}>The route</div>
          <p style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            The Loop runs Friday, Saturday, and Sunday from 9 to 5, from the base gate through our sponsor
            spots and back. Pick a stop, hop off, and catch the next loop when you are ready.
          </p>
        </section>

        <section style={{ ...card, padding: '20px 18px', textAlign: 'center' }}>
          <div style={{ color: INK, fontSize: 17, fontWeight: 800 }}>Ready to ride?</div>
          <div style={{ color: INK_DIM, fontSize: 13.5, margin: '6px 0 14px' }}>
            Verify your military ID once and you are cleared for every loop.
          </div>
          <a href="/marines/verify" style={primaryCta}>Verify to ride</a>
        </section>

      </div>
    </main>
  )
}

const card = { borderRadius: 14, background: SURFACE, border: `1px solid ${LINE}` }
const eyebrow = { color: SAND, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }
const sectionLabel = { fontSize: 11, color: SAND, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }
const stepNum = { flex: '0 0 auto', width: 26, height: 26, borderRadius: 7, border: `1px solid ${OLIVE}`, color: OLIVE_HI, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const primaryCta = { display: 'inline-block', padding: '13px 22px', borderRadius: 10, background: `linear-gradient(180deg, ${OLIVE_HI}, ${OLIVE})`, color: '#13160c', fontWeight: 800, textDecoration: 'none', fontSize: 15, boxShadow: '0 10px 24px rgba(138,154,79,0.28)' }
const ghostCta = { display: 'inline-block', padding: '12px 18px', borderRadius: 999, background: 'transparent', color: INK, border: `1px solid ${LINE}`, fontWeight: 600, textDecoration: 'none', fontSize: 14 }
