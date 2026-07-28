// Jville Brew Loop — public marketing landing, built on the StoryBrand
// BrandScript, laid out like the Loop Network front page: left-aligned copy, a
// 2-column hero with a pure-CSS product mockup on the right, left-aligned
// section intros, multi-column grids. Server-renderable (no hooks).
//
//   Hero (character) = a group going out who don't want anyone to be the drunk
//                      driver stop to stop.  Villain = "I'm fine to drive."
//   Guide            = the Brew Loop (flat $20, tracked, back to your pickup).
//   Plan             = book → get to the first bar (Uber/partnered taxi) → hop
//                      the Loop all night, back to your pickup.
//
// ACCURACY: the Loop is a bar-hop shuttle that returns riders to their ORIGINAL
// PICKUP — NOT a ride home. Never say "ride home."

import Link from 'next/link'
import { BARS } from '@/lib/bars'
import { SPONSORS } from '@/lib/sponsors'
import {
  GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, LINE, LINE_HI, SURFACE, BG, MAX_W,
  primaryCta, primaryCtaLg, ghostCta, eyebrow, softCard, stepNum, pulseDot, HERO_GLOW, GOLD_WASH,
} from '@/lib/marketingTheme'

const PROBLEM = [
  { title: 'Someone always has to drive', sub: 'Bar-hopping means a buzzed drive between every stop, or a designated driver who sits the whole night out. Neither is a good night.' },
  { title: 'Rideshare roulette', sub: 'Surge pricing, no-show drivers, and the group splitting into three cars that never end up at the same bar.' },
  { title: 'The parking-lot decision', sub: 'Circling for a spot at every bar, then the worst call of the night waiting for you in the lot: “I’m fine to drive.”' },
]

const WHY = [
  { icon: 'price', title: 'One flat price', sub: '$20 covers your whole night on the Loop. No surge, no per-ride math, no surprises.' },
  { icon: 'route', title: 'The best bars, handled', sub: 'A tracked, scheduled route through Jacksonville’s favorite spots — about an hour and 15 at each.' },
  { icon: 'nodrive', title: 'Nobody drives drunk', sub: 'You never touch your keys between bars. That’s the entire point of the Loop.' },
  { icon: 'track', title: 'Track it live', sub: 'See exactly where the shuttle is all night. Never wonder when it’s coming back around.' },
]

const STEPS = [
  { n: '01', title: 'Book your seat', sub: '$20 covers your whole night. Sign the waiver inline, pay, done — takes a minute.' },
  { n: '02', title: 'Get to the first bar', sub: 'Leave the car at home. Grab an Uber or one of our partnered taxis to your pickup spot. We text you the exact time and place.' },
  { n: '03', title: 'Hop the Loop all night', sub: 'Ride bar to bar with your friends, track the shuttle live, and end the night right back where you started.' },
]

const FAQ = [
  { q: 'How much is a ticket?', a: '$20 per seat. One ticket covers your whole night on the Loop.' },
  { q: 'How long are we at each bar?', a: 'About an hour and 15 minutes per stop. It’s a tracked, scheduled route — not hop-on / hop-off.' },
  { q: 'How do I get to and from the Loop?', a: 'Leave your car at home. Take an Uber or one of our partnered taxi services to your pickup spot, ride the Loop all night, and it brings you back to that same spot at the end. Grab a ride home from there.' },
  { q: 'How will I know when the shuttle is leaving?', a: 'You’ll get a text about 10 minutes before we roll, so you can close your tab and finish your drink.' },
  { q: 'What time does it run?', a: 'First pickup is around 7:30 PM and we wrap up around 1:30 AM.' },
  { q: 'Do I have to be 21?', a: 'Yes. The Loop is strictly 21+.' },
  { q: 'Which bars are on the route?', a: 'Eight partner bars around Jacksonville rotate weekend to weekend, and Friday’s route can differ from Saturday’s. Check the event you’re booking for that night’s exact stops.' },
]

const PARTNER_BARS = BARS.filter(b => b.address && b.slug !== 'partner-8')

export default function BrewLanding({ loops = [] }) {
  const next = loops[0] || null
  return (
    <main className="site-main">
      <Hero next={next} />
      <Problem />
      <Why />
      <Plan />
      <PartnerBars />
      <SuccessBand />
      <PriceFaq />
      <SponsorStrip />
      <HeroStyles />
    </main>
  )
}

/* ---------------------------------- Hero --------------------------------- */

function Hero({ next }) {
  return (
    <section style={{ position: 'relative', padding: 'clamp(48px, 7vw, 104px) 24px clamp(44px, 6vw, 84px)' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: HERO_GLOW, pointerEvents: 'none' }} />
      <div className="bl-hero" style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', display: 'grid', gap: 'clamp(32px, 5vw, 72px)', alignItems: 'center' }}>
        {/* Copy — left */}
        <div className="bl-hero-copy">
          <span style={heroPill}>
            <span style={pulseDot} /> Jacksonville&rsquo;s weekend bar-hop shuttle
          </span>
          <h1 style={{ color: INK, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.02, fontSize: 'clamp(40px, 5vw, 76px)', margin: '20px 0 0' }}>
            Hit every bar.<br /><span style={{ color: GOLD_HI }}>Never touch your keys.</span>
          </h1>
          <p style={{ color: INK_DIM, fontSize: 'clamp(16px, 1.5vw, 20px)', lineHeight: 1.55, margin: '20px 0 0', maxWidth: 540 }}>
            The Brew Loop is a shuttle that loops the best bars in Jacksonville all night, so nobody in your
            group has to be the one who drives. $20 flat, tracked live, and back to your pickup at the end.
          </p>
          <div className="bl-hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
            <Link href="/events" style={primaryCtaLg}>Book a seat</Link>
            <Link href="/track" style={{ ...ghostCta, padding: '15px 24px', fontSize: 15 }}>Find my bus</Link>
          </div>
          <div className="bl-hero-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
            {['$20 flat', '8 partner bars', 'Tracked live', '21+'].map(c => (
              <span key={c} style={trustChip}><Check /> {c}</span>
            ))}
          </div>
        </div>

        {/* Visual — right */}
        <div className="bl-hero-visual">
          <HeroMockup next={next} />
        </div>
      </div>
    </section>
  )
}

// Pure-CSS "tonight's loop" boarding-pass / live-route card — the Brew analog of
// Loop Network's TvMockup. Uses the next loop's real stops when available.
function HeroMockup({ next }) {
  const stopNames = (next?.stops?.length ? next.stops.map(s => s.name) : PARTNER_BARS.map(b => b.name)).slice(0, 4)
  const liveIdx = Math.min(1, stopNames.length - 1)
  const dateLabel = next
    ? `${formatDate(next.eventDate)}${next.pickupTime ? ` · ${formatTime(next.pickupTime)}` : ''}`
    : 'Every Fri & Sat night'

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
      <div style={{ ...softCard, padding: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', background: `radial-gradient(120% 70% at 50% 0%, rgba(212,163,51,0.12), transparent 60%), ${SURFACE}` }}>
        <div aria-hidden style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(212,163,51,0.16), transparent 70%)' }} />
        {/* header */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
            <span style={pulseDot} /> Live on the Loop
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/badge-gold.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain', display: 'block' }} />
        </div>
        <div style={{ position: 'relative', color: INK, fontSize: 19, fontWeight: 800, margin: '14px 0 2px', letterSpacing: '-0.01em' }}>{dateLabel}</div>
        <div style={{ color: INK_MUTE, fontSize: 12, marginBottom: 16 }}>Tonight&rsquo;s route</div>

        {/* route */}
        <div style={{ position: 'relative' }}>
          {stopNames.map((s, i) => {
            const live = i === liveIdx
            const last = i === stopNames.length - 1
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span aria-hidden style={live ? routeDotLive : routeDot} />
                  {!last && <span aria-hidden style={{ width: 2, flex: 1, minHeight: 22, background: LINE_HI }} />}
                </div>
                <div style={{ paddingBottom: last ? 0 : 16 }}>
                  <div style={{ color: live ? INK : INK_DIM, fontSize: 14, fontWeight: live ? 800 : 600 }}>{s}</div>
                  {live && <span style={shuttleChip}>Shuttle here</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* footer */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
          <div>
            <div style={{ color: GOLD_HI, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>$20</div>
            <div style={{ color: INK_MUTE, fontSize: 11.5, marginTop: 3 }}>all night · one seat</div>
          </div>
          <FauxQr />
        </div>
      </div>
    </div>
  )
}

function FauxQr() {
  // Fixed pattern so it never changes between renders.
  const cells = [1,0,1,1,0,1, 0,1,0,1,1,0, 1,1,1,0,1,1, 0,0,1,1,0,1, 1,0,1,0,1,0, 0,1,1,0,1,1]
  return (
    <div aria-hidden style={{ width: 54, height: 54, borderRadius: 8, background: 'rgba(255,255,255,0.92)', padding: 5, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1.5 }}>
      {cells.map((c, i) => <span key={i} style={{ background: c ? BG : 'transparent', borderRadius: 1 }} />)}
    </div>
  )
}

/* -------------------------------- Problem -------------------------------- */

function Problem() {
  return (
    <Section band>
      <Header
        eyebrow="Bad nights start with &ldquo;I&rsquo;m fine to drive.&rdquo;"
        title="A great night out shouldn&rsquo;t come with a bad decision."
        sub="Bar-hopping in Jacksonville usually means someone ends up behind the wheel they shouldn&rsquo;t. It doesn&rsquo;t have to."
      />
      <Grid min={260} style={{ marginTop: 34 }}>
        {PROBLEM.map(p => (
          <div key={p.title} style={{ ...softCard, padding: '22px 20px' }}>
            <div style={{ color: INK, fontSize: 17, fontWeight: 800 }}>{p.title}</div>
            <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: '8px 0 0' }}>{p.sub}</p>
          </div>
        ))}
      </Grid>
    </Section>
  )
}

/* ---------------------------------- Why ---------------------------------- */

function Why() {
  return (
    <Section>
      <Header
        eyebrow="Why the Loop"
        title="One flat fare. Every bar. Nobody driving."
        sub="We built the Brew Loop so a full night out doesn&rsquo;t hinge on who&rsquo;s sober enough to drive between stops."
      />
      <Grid min={230} style={{ marginTop: 34 }}>
        {WHY.map(w => (
          <div key={w.title} style={{ padding: '4px 2px' }}>
            <div style={iconDot} aria-hidden><WhyIcon kind={w.icon} /></div>
            <div style={{ color: INK, fontSize: 16, fontWeight: 800, marginTop: 14 }}>{w.title}</div>
            <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, margin: '6px 0 0' }}>{w.sub}</p>
          </div>
        ))}
      </Grid>
    </Section>
  )
}

/* --------------------------------- Plan ---------------------------------- */

function Plan() {
  return (
    <Section band id="how">
      <Header eyebrow="How a night runs" title="Three steps to a night nobody has to sober-drive." />
      <Grid min={260} style={{ marginTop: 34 }}>
        {STEPS.map(s => (
          <div key={s.n} style={{ ...softCard, padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={stepNum}>{s.n}</span>
              <span style={{ color: GOLD, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>Step</span>
            </div>
            <div style={{ color: INK, fontSize: 18, fontWeight: 800, marginTop: 16 }}>{s.title}</div>
            <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: '8px 0 0' }}>{s.sub}</p>
          </div>
        ))}
      </Grid>
      <div style={{ marginTop: 30 }}>
        <Link href="/events" style={primaryCta}>Book a seat</Link>
      </div>
    </Section>
  )
}

/* ------------------------------ Partner bars ----------------------------- */

function PartnerBars() {
  return (
    <Section>
      <Header
        eyebrow="Partner bars"
        title="The best spots in Jacksonville, on one route."
        sub="Eight partner bars rotate through the Loop weekend to weekend. Here&rsquo;s who rides with us."
      />
      <Grid min={220} style={{ marginTop: 30 }}>
        {PARTNER_BARS.map(b => (
          <Link key={b.slug} href={`/bars/${b.slug}`} style={{ ...softCard, padding: '18px 18px', textDecoration: 'none', display: 'block' }}>
            <div style={{ color: INK, fontSize: 16, fontWeight: 800 }}>{b.name}</div>
            {b.neighborhood && (
              <div style={{ color: GOLD, fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginTop: 4 }}>{b.neighborhood}</div>
            )}
            {b.blurb && <p style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '10px 0 0' }}>{b.blurb}</p>}
          </Link>
        ))}
      </Grid>
      <div style={{ marginTop: 30 }}>
        <Link href="/bars" style={ghostCta}>See all partner bars</Link>
      </div>
    </Section>
  )
}

/* ------------------------------ Success band ----------------------------- */

function SuccessBand() {
  return (
    <Section>
      <div style={{
        ...softCard, padding: 'clamp(30px, 5vw, 48px)',
        background: `linear-gradient(120deg, ${GOLD_WASH}, transparent 70%)`, border: `1px solid rgba(212,163,51,0.28)`,
        display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Out together, nobody behind the wheel</div>
          <h2 style={{ color: INK, fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, lineHeight: 1.12 }}>
            The whole night handled.
          </h2>
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.55, margin: '12px 0 0' }}>
            Everyone hits every bar, nobody&rsquo;s the designated driver, and the night ends back at your pickup.
            Grab an Uber or a partnered taxi home from there.
          </p>
        </div>
        <Link href="/events" style={{ ...primaryCtaLg, flex: '0 0 auto' }}>Book a seat</Link>
      </div>
    </Section>
  )
}

/* ------------------------------- Price + FAQ ----------------------------- */

function PriceFaq() {
  return (
    <Section band>
      <div style={{ display: 'grid', gap: 'clamp(24px, 4vw, 48px)', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        {/* Price */}
        <div>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Simple pricing</div>
          <div style={{ ...softCard, padding: '30px 26px', border: `1px solid rgba(212,163,51,0.3)`, background: `linear-gradient(180deg, ${GOLD_WASH}, ${SURFACE})` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: GOLD_HI, fontSize: 'clamp(44px, 8vw, 60px)', fontWeight: 800, letterSpacing: '-0.02em' }}>$20</span>
              <span style={{ color: INK_DIM, fontSize: 16, fontWeight: 600 }}>/ seat</span>
            </div>
            <p style={{ color: INK, fontSize: 15.5, lineHeight: 1.55, margin: '10px 0 18px' }}>
              One flat price covers your whole night on the Loop. No surge, no per-ride math.
            </p>
            <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'grid', gap: 10 }}>
              {['Ride all night, bar to bar', 'Live shuttle tracking', 'Back to your original pickup', 'Groups of 5+ can request a custom pickup'].map(t => (
                <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: INK_DIM, fontSize: 14.5 }}>
                  <span style={{ color: GOLD, flex: '0 0 auto', marginTop: 1 }}><Check /></span> {t}
                </li>
              ))}
            </ul>
            <Link href="/events" style={{ ...primaryCta, width: '100%' }}>Book a seat</Link>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <div style={{ ...eyebrow, marginBottom: 12 }}>Questions riders ask</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {FAQ.map((it, i) => (
              <details key={i} style={{ ...softCard, padding: '16px 18px' }}>
                <summary style={{ cursor: 'pointer', listStyle: 'none', color: INK, fontWeight: 700, fontSize: 15.5, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
                  <span>{it.q}</span>
                  <span aria-hidden style={{ color: GOLD, fontSize: 20, lineHeight: 1, flex: '0 0 auto' }}>+</span>
                </summary>
                <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.6, margin: '12px 0 0' }}>{it.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------ Sponsor strip ---------------------------- */

function SponsorStrip() {
  return (
    <Section band>
      <div style={{ maxWidth: 620 }}>
        <div style={eyebrow}>Partners &amp; sponsors</div>
        <h2 style={{ color: INK, fontSize: 'clamp(22px, 3.6vw, 32px)', fontWeight: 800, letterSpacing: '-0.01em', margin: '12px 0 0' }}>
          Backed by Jacksonville businesses.
        </h2>
        <p style={{ color: INK_DIM, fontSize: 15.5, lineHeight: 1.55, margin: '12px 0 0' }}>
          Local shops, spots, and services ride with the Loop every weekend.
        </p>
      </div>

      {/* Logo strip — small logo coins on the dark theme, name beside each */}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', marginTop: 26 }}>
        {SPONSORS.map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" title={s.name}
            style={{ ...softCard, display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', textDecoration: 'none' }}>
            <span style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: 9, background: '#f4f2ec', display: 'grid', placeItems: 'center', padding: 5, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo} alt={s.name} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </span>
            <span style={{ color: INK, fontSize: 13, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em', overflow: 'hidden' }}>{s.name}</span>
          </a>
        ))}
      </div>

      {/* CTA */}
      <div style={{ ...softCard, marginTop: 22, padding: 'clamp(24px, 4vw, 36px)', display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', justifyContent: 'space-between', border: `1px solid rgba(212,163,51,0.28)`, background: `linear-gradient(120deg, ${GOLD_WASH}, transparent 70%)` }}>
        <div style={{ maxWidth: 560 }}>
          <h3 style={{ color: INK, fontSize: 'clamp(19px, 3vw, 24px)', fontWeight: 800, margin: 0 }}>
            Want your brand in front of a full shuttle every weekend?
          </h3>
          <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            Sponsor a weekend, host a pickup, or become a featured partner.
          </p>
        </div>
        <Link href="/sponsors" style={{ ...primaryCta, flex: '0 0 auto' }}>Become a partner</Link>
      </div>
    </Section>
  )
}

/* ------------------------------- Primitives ------------------------------ */

function Section({ children, band, id }) {
  return (
    <section
      id={id}
      style={{
        padding: 'clamp(52px, 8vw, 96px) 24px',
        borderTop: band ? `1px solid ${LINE}` : undefined,
        borderBottom: band ? `1px solid ${LINE}` : undefined,
        background: band ? 'rgba(255,255,255,0.015)' : undefined,
        scrollMarginTop: 72,
      }}
    >
      <div style={{ maxWidth: MAX_W, margin: '0 auto' }}>{children}</div>
    </section>
  )
}

// Left-aligned section header (Loop Network style).
function Header({ eyebrow: eb, title, sub }) {
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={eyebrow} dangerouslySetInnerHTML={{ __html: eb }} />
      <h2
        style={{ color: INK, fontSize: 'clamp(24px, 4.2vw, 38px)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.12, margin: '12px 0 0' }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {sub && (
        <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.55, margin: '14px 0 0' }} dangerouslySetInnerHTML={{ __html: sub }} />
      )}
    </div>
  )
}

function Grid({ children, min = 240, style }) {
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, ...style }}>
      {children}
    </div>
  )
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function WhyIcon({ kind }) {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: GOLD_HI, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (kind === 'price') return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.2A2.2 2.2 0 0 1 12 8.2c1.2 0 2.2.8 2.2 1.7 0 2.4-4.4 1.3-4.4 3.7 0 .9 1 1.7 2.2 1.7 1 0 1.9-.5 2.2-1.2" /></svg>)
  if (kind === 'route') return (<svg {...p}><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h6a4 4 0 0 0 4-4V8" /></svg>)
  if (kind === 'nodrive') return (<svg {...p}><path d="M12 3l8 4v5c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>)
  if (kind === 'track') return (<svg {...p}><circle cx="12" cy="11" r="2.5" /><path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" /></svg>)
  return null
}

function HeroStyles() {
  return (
    <style>{`
      .bl-hero { grid-template-columns: 1fr; text-align: center; }
      .bl-hero-copy p { margin-left: auto; margin-right: auto; }
      .bl-hero-cta, .bl-hero-chips { justify-content: center; }
      .bl-hero-pill { justify-content: center; }
      @media (min-width: 900px) {
        .bl-hero { grid-template-columns: 1.05fr 0.95fr; text-align: left; }
        .bl-hero-copy p { margin-left: 0; margin-right: 0; }
        .bl-hero-cta, .bl-hero-chips { justify-content: flex-start; }
        .bl-hero-pill { justify-content: flex-start; }
      }
    `}</style>
  )
}

const heroPill = {
  display: 'inline-flex', alignItems: 'center', gap: 9,
  padding: '7px 14px', borderRadius: 999, border: `1px solid ${LINE_HI}`,
  background: 'rgba(212,163,51,0.06)', color: GOLD, fontSize: 11.5, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
}
const trustChip = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999,
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE}`, color: INK_DIM, fontSize: 13, fontWeight: 600,
}
const iconDot = {
  width: 40, height: 40, borderRadius: 11, background: 'rgba(212,163,51,0.12)',
  border: `1px solid rgba(212,163,51,0.32)`, display: 'grid', placeItems: 'center',
}
const routeDot = {
  width: 12, height: 12, borderRadius: '50%', border: `2px solid ${GOLD}`, background: 'transparent', flex: '0 0 auto', marginTop: 2,
}
const routeDotLive = {
  width: 16, height: 16, borderRadius: '50%', background: GOLD, boxShadow: `0 0 0 4px rgba(212,163,51,0.2)`, flex: '0 0 auto', marginTop: 1,
}
const shuttleChip = {
  display: 'inline-block', marginTop: 6, padding: '3px 9px', borderRadius: 999,
  background: 'rgba(212,163,51,0.14)', border: `1px solid rgba(212,163,51,0.4)`,
  color: GOLD_HI, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
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
