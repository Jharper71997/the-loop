// The Loop — rider-facing landing.
// A fixed-route shuttle: board at the on-base gate, ride the "red line" through
// stops all over town. Single Ride $10 (one boarding) or Day Pass $20 (hop on
// and off all day). ID required to ride — you verify once, and the driver
// checks an ID at the door. Standalone identity, NOT Brew Loop branded.

import { C, card, eyebrow, sectionLabel, primaryCta, ghostCta } from '../_theme'

export const metadata = {
  title: { absolute: 'The Loop — ride the red line' },
  description: 'Board at the gate and ride the red line all weekend. Single ride $10 or a $20 day pass to hop on and off all day.',
  alternates: { canonical: '/marines' },
}

const BG_GLOW = 'radial-gradient(120% 80% at 50% 0%, rgba(229,72,77,0.20), transparent 60%), #1a2027'

const PASSES = [
  { name: 'Single Ride', price: '$10', note: 'One boarding. Ride to a stop and hop off.' },
  { name: 'Day Pass', price: '$20', note: 'Hop on and off all day, as many loops as you want.', featured: true },
]

const STEPS = [
  ['Verify once', 'Confirm your ID one time, then you are cleared to ride.'],
  ['Get your ride', 'Grab a single ride for $10, or a day pass for $20.'],
  ['Board at the gate', 'Catch The Loop at the on-base stop — the first stop on the red line.'],
  ['Ride the red line', 'Stay on to your stop, or with a day pass hop on and off all day.'],
]

export default function LoopLanding() {
  return (
    <main className="external-shell" style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>

        {/* Hero */}
        <section style={{ ...card, borderRadius: 18, position: 'relative', overflow: 'hidden', padding: '28px 22px 24px', background: BG_GLOW, border: `1px solid ${C.LINE}`, boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
          <div aria-hidden style={{ position: 'absolute', right: -40, bottom: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(229,72,77,0.18), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.RED, boxShadow: `0 0 10px ${C.RED}`, display: 'inline-block' }} />
            The red line · all weekend
          </div>
          <h1 style={{ position: 'relative', color: C.INK, fontSize: 32, fontWeight: 800, margin: '10px 0 8px', letterSpacing: '-0.015em', lineHeight: 1.06 }}>
            Board at the gate. Ride the red line.
          </h1>
          <p style={{ position: 'relative', color: C.INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
            The Loop is a fixed-route shuttle. Hop on at the on-base stop and ride the red line to spots
            all over town. Ten dollars to ride, or grab a day pass and hop on and off all day. No car needed.
          </p>
          <div style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <a href="/marines/buy" style={primaryCta}>Get a ride</a>
            <a href="/marines/track" style={ghostCta}>See it live</a>
          </div>
          <div style={{ position: 'relative', color: C.INK_DIM, fontSize: 12, marginTop: 12 }}>ID required to ride. You only verify once.</div>
        </section>

        {/* How it works */}
        <section>
          <div style={sectionLabel}>How it works</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {STEPS.map(([title, body], i) => (
              <div key={title} style={{ ...softCard, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={stepNum}>{i + 1}</span>
                <div>
                  <div style={{ color: C.INK, fontSize: 15, fontWeight: 700 }}>{title}</div>
                  <div style={{ color: C.INK_DIM, fontSize: 13.5, marginTop: 2, lineHeight: 1.45 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Passes */}
        <section>
          <div style={sectionLabel}>Fares</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {PASSES.map(p => (
              <div key={p.name} style={{ ...softCard, padding: '16px 14px',
                border: `1px solid ${p.featured ? 'rgba(229,72,77,0.5)' : C.LINE}`,
                background: p.featured ? 'rgba(229,72,77,0.10)' : C.SURFACE,
                boxShadow: p.featured ? '0 14px 30px rgba(229,72,77,0.16)' : '0 14px 30px rgba(0,0,0,0.22)' }}>
                <div style={{ color: p.featured ? C.RED_HI : C.INK, fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                <div style={{ color: C.WARM, fontSize: 24, fontWeight: 800, margin: '4px 0 6px' }}>{p.price}</div>
                <div style={{ color: C.INK_DIM, fontSize: 12.5, lineHeight: 1.4 }}>{p.note}</div>
              </div>
            ))}
          </div>
          <div style={{ color: C.INK_DIM, fontSize: 12, marginTop: 8 }}>
            Single ride is one boarding — hop off and the next ride is another $10. The day pass is the easy one.
          </div>
        </section>

        {/* Route */}
        <section style={{ ...softCard, padding: '16px 16px' }}>
          <div style={sectionLabel}>The route</div>
          <p style={{ color: C.INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            The red line starts at the on-base gate and runs a fixed loop of stops all over town. The route
            changes week to week — check the live map for this weekend{"'"}s stops and where the shuttle is right now.
          </p>
        </section>

        <section style={{ ...softCard, padding: '22px 18px', textAlign: 'center', background: BG_GLOW }}>
          <div style={{ color: C.INK, fontSize: 17, fontWeight: 800 }}>Ready to ride?</div>
          <div style={{ color: C.INK_DIM, fontSize: 13.5, margin: '6px 0 14px' }}>
            Verify your ID once and you are cleared for every loop.
          </div>
          <a href="/marines/buy" style={primaryCta}>Get a ride</a>
        </section>

      </div>
    </main>
  )
}

const softCard = { ...card, borderRadius: 16, boxShadow: '0 14px 30px rgba(0,0,0,0.22)' }
const stepNum = { flex: '0 0 auto', width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.RED}`, color: C.RED_HI, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
