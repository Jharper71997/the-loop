// Jville Brew Loop — public landing page.
//
// Rebuilt 2026-08-05 against two pieces of feedback: "too blocky, the black
// looks boring" and "still confusing". Both had the same root cause — eight
// sections that were all `eyebrow + heading + row of identical bordered
// rectangles` on one flat black fill. Nothing looked more important than
// anything else, so nothing guided you anywhere.
//
// Now FOUR sections, each with a genuinely different texture and job:
//
//   1. HERO       photograph + scrim + grain           → what this is, book it
//   2. THE NIGHT  asymmetric timeline + shuttle render → how it works
//   3. THE BARS   photo mosaic of real bar signage     → where it goes (colour)
//   4. THE GEAR   merch photography + closing CTA      → wear it / book it
//
// One CTA wording throughout: "Book a seat". Not "Buy Tickets" here and "Book"
// there. Depth comes from lib/atmosphere.js, copy from lib/riderInfo.js.
//
// ACCURACY: the Loop returns riders to their ORIGINAL PICKUP. Never "ride home."

import Link from 'next/link'
import { PUBLIC_PARTNER_BARS, PARTNER_BAR_COUNT } from '@/lib/bars'
import { SPONSORS } from '@/lib/sponsors'
import { STEPS, FAQ, LANDING_FAQ_COUNT } from '@/lib/riderInfo'
import {
  GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, LINE, LINE_HI, MAX_W,
  primaryCtaLg, ghostCta, eyebrow, pulseDot,
} from '@/lib/marketingTheme'
import {
  TONES, grainOverlay, lightPool, photoScrim,
  litCard, litCardInner, fadeRule,
} from '@/lib/atmosphere'
import BarTiles from './BarTiles'
import Faq from './Faq'

const LANDING_FAQ = FAQ.slice(0, LANDING_FAQ_COUNT)

// Bar tiles are uniform on purpose. Two attempts at an uneven bento left dead
// black space under the short tiles (row heights get driven by the tallest
// cell, and a contained logo doesn't fill a tall box). The variety comes from
// the ARTWORK — seven signs in seven different colours — not from the frames.
// A consistent frame around inconsistent art reads as a collection; the
// reverse reads as a bug. See ./BarTiles.jsx.

const MERCH_SHOTS = [
  { src: '/brand/merch/hoodie-4.png', label: 'Hoodie', price: '$55' },
  { src: '/brand/merch/tshirt-5.png', label: 'Tee', price: '$35' },
  { src: '/brand/merch/hoodie-1.png', label: 'Hoodie', price: '$55' },
  { src: '/brand/merch/patches.png', label: 'Patch', price: '$10' },
]

export default function BrewLanding({ loops = [] }) {
  const next = loops[0] || null
  return (
    <main className="site-main" style={{ background: TONES.base }}>
      <Hero next={next} />
      <TheNight />
      <TheBars />
      <TheGear />
      <Closer />
      <LandingStyles />
    </main>
  )
}

/* =============================== 1. HERO ================================= */
/* A photograph, not a black box. Copy sits in the dark side of the scrim.   */

function Hero({ next }) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: TONES.void }}>
      {/* Real footage of the shuttle. The poster paints instantly (and is the
          whole story on reduced-motion / slow connections), the video fades in
          over it once it can play. Muted + playsInline are REQUIRED for autoplay
          to be allowed on iOS and Chrome. */}
      <div
        aria-hidden
        className="bl-hero-media"
        style={{ backgroundImage: 'url(/brand/photos/hero-poster.jpg)' }}
      >
        <video
          className="bl-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/brand/photos/hero-poster.jpg"
        >
          <source src="/brand/video/hero-loop-720.mp4" type="video/mp4" media="(max-width: 900px)" />
          <source src="/brand/video/hero-loop.mp4" type="video/mp4" />
        </video>
      </div>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: photoScrim }} />
      <div aria-hidden style={grainOverlay} />

      <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(72px, 12vw, 148px) 24px clamp(56px, 8vw, 104px)' }}>
        <div style={{ maxWidth: 720 }}>
          <span style={heroPill}>
            <span style={pulseDot} /> Jacksonville&rsquo;s weekend bar-hop shuttle
          </span>

          <h1 className="bl-h1" style={{
            color: INK, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 0.98,
            fontSize: 'clamp(44px, 8vw, 92px)', margin: '22px 0 0',
            textShadow: '0 4px 40px rgba(0,0,0,0.6)',
          }}>
            Hit every bar.<br />
            <span style={{ color: GOLD_HI }}>Never touch your keys.</span>
          </h1>

          <p style={{
            color: '#d9d9de', fontSize: 'clamp(16px, 1.7vw, 21px)', lineHeight: 1.5,
            margin: '22px 0 0', maxWidth: 540, textShadow: '0 2px 20px rgba(0,0,0,0.7)',
          }}>
            One shuttle, looping the best bars in town all night, so nobody in your group
            has to be the one who drives.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32, alignItems: 'center' }}>
            <Link href="/events" style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>
              Book a seat &middot; $20
            </Link>
            {next && <NextLoopChip next={next} />}
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 30, color: INK_MUTE, fontSize: 13.5, fontWeight: 600 }}>
            <span>{PARTNER_BAR_COUNT} partner bars</span>
            <span aria-hidden style={{ opacity: 0.4 }}>/</span>
            <span>Tracked live all night</span>
            <span aria-hidden style={{ opacity: 0.4 }}>/</span>
            <span>Strictly 21+</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function NextLoopChip({ next }) {
  return (
    <Link href="/events" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none',
      padding: '13px 18px', borderRadius: 999,
      background: 'rgba(10,10,11,0.55)', border: `1px solid ${LINE_HI}`,
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    }}>
      <span style={pulseDot} />
      <span style={{ color: INK, fontSize: 14, fontWeight: 700 }}>
        Next loop {formatDate(next.eventDate)}
      </span>
      {next.pickupTime && (
        <span style={{ color: INK_MUTE, fontSize: 13 }}>{formatTime(next.pickupTime)}</span>
      )}
    </Link>
  )
}

/* ============================= 2. THE NIGHT ============================== */
/* Asymmetric: a vertical timeline on the left, the shuttle floating right.  */
/* Deliberately NOT three matching cards in a row.                           */

function TheNight() {
  return (
    <section style={{ position: 'relative', background: TONES.raised, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-right', 0.15) }} />
      <div aria-hidden style={grainOverlay} />

      <div className="bl-night" style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(64px, 9vw, 112px) 24px' }}>
        <div>
          <div style={eyebrow}>How a night runs</div>
          <h2 className="bl-h2" style={sectionH2}>
            Three steps, then<br />the night is handled.
          </h2>

          {/* Timeline — one continuous gold line threading the steps */}
          <ol style={{ listStyle: 'none', margin: '40px 0 0', padding: 0, position: 'relative' }}>
            {STEPS.map((s, i) => {
              const last = i === STEPS.length - 1
              return (
                <li key={s.n} style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                    <span style={timelineNum}>{s.n}</span>
                    {!last && <span aria-hidden style={{ width: 2, flex: 1, minHeight: 30, background: `linear-gradient(180deg, ${GOLD}, rgba(212,163,51,0.12))` }} />}
                  </div>
                  <div style={{ paddingBottom: last ? 0 : 34, maxWidth: 460 }}>
                    <h3 style={{ color: INK, fontSize: 'clamp(19px, 2.4vw, 23px)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{s.title}</h3>
                    <p style={{ color: INK_DIM, fontSize: 15.5, lineHeight: 1.6, margin: '9px 0 0' }}>{s.sub}</p>
                  </div>
                </li>
              )
            })}
          </ol>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 40 }}>
            <Link href="/events" style={{ ...primaryCtaLg, padding: '15px 26px' }}>Book a seat</Link>
            <Link href="/about" style={{ ...ghostCta, padding: '15px 24px' }}>Read the full rundown</Link>
          </div>
        </div>

        {/* Shuttle + price, floating */}
        <div className="bl-night-aside">
          <div style={{ position: 'relative' }}>
            <div aria-hidden style={{
              position: 'absolute', inset: '-8% -6%', borderRadius: '50%',
              background: 'radial-gradient(50% 50% at 50% 50%, rgba(212,163,51,0.22), transparent 70%)',
              filter: 'blur(8px)',
            }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/photos/shuttle.jpg"
              alt="The Jville Brew Loop shuttle"
              style={{ position: 'relative', width: '100%', display: 'block', mixBlendMode: 'screen' }}
            />
          </div>

          <div style={{ ...litCard({ radius: 20 }), marginTop: 8 }}>
            <div style={litCardInner({ radius: 19, pad: 26 })}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ color: GOLD_HI, fontSize: 'clamp(40px, 6vw, 54px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>$20</span>
                <span style={{ color: INK_DIM, fontSize: 16, fontWeight: 600 }}>a seat</span>
              </div>
              <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 0' }}>
                Covers your whole night. No surge, no per-ride math, and it brings you back
                to the same spot you started.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================== 3. THE BARS ============================== */
/* The colour moment. Real signage, uneven tiles, no text cards.             */

function TheBars() {
  return (
    <section style={{ position: 'relative', background: TONES.void, overflow: 'hidden' }}>
      <hr style={fadeRule} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-left', 0.1) }} />

      <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(64px, 9vw, 112px) 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 560 }}>
            <div style={eyebrow}>Where it goes</div>
            <h2 className="bl-h2" style={sectionH2}>The best spots in town, on one route.</h2>
          </div>
          <Link href="/bars" style={{ ...ghostCta, padding: '13px 22px' }}>All {PARTNER_BAR_COUNT} bars</Link>
        </div>

        <BarTiles bars={PUBLIC_PARTNER_BARS} />

        <p style={{ color: INK_MUTE, fontSize: 14, lineHeight: 1.6, margin: '22px 0 0', maxWidth: 620 }}>
          The route rotates weekend to weekend, and Friday can differ from Saturday. The night
          you book always lists its exact stops.
        </p>
      </div>
    </section>
  )
}

/* ============================== 4. THE GEAR ============================== */
/* Merch as real photography, plus the questions people still have.          */

function TheGear() {
  return (
    <section style={{ position: 'relative', background: TONES.panel, overflow: 'hidden' }}>
      <hr style={fadeRule} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('right', 0.12) }} />
      <div aria-hidden style={grainOverlay} />

      <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(64px, 9vw, 112px) 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 560 }}>
            <div style={eyebrow}>Merch</div>
            <h2 className="bl-h2" style={sectionH2}>Wear the gold badge.</h2>
            <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.55, margin: '14px 0 0' }}>
              Black-and-gold Brew Loop gear. Ships to your door, or grab it on the shuttle.
            </p>
          </div>
          <Link href="/merch" style={{ ...ghostCta, padding: '13px 22px' }}>Shop merch</Link>
        </div>

        <div className="bl-merch">
          {MERCH_SHOTS.map((m, i) => (
            <Link key={i} href="/merch" className="bl-merch-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={m.label} loading="lazy" />
              <span className="bl-merch-meta">
                <span style={{ color: INK, fontSize: 14.5, fontWeight: 700 }}>{m.label}</span>
                <span style={{ color: GOLD_HI, fontSize: 14.5, fontWeight: 800 }}>{m.price}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Remaining questions — compact, two columns, not a stack of fat cards */}
        <div style={{ marginTop: 'clamp(48px, 7vw, 80px)' }}>
          <div style={eyebrow}>Before you book</div>
          <Faq items={LANDING_FAQ} />
          <p style={{ margin: '18px 0 0' }}>
            <Link href="/about#faq" style={{ color: GOLD_HI, fontWeight: 700, fontSize: 14.5, textDecoration: 'none' }}>
              All {FAQ.length}{' '}questions &rarr;
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

/* =============================== CLOSER ================================== */

function Closer() {
  return (
    <section style={{ position: 'relative', background: TONES.void, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('bottom', 0.2) }} />
      <div aria-hidden style={grainOverlay} />

      <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(64px, 9vw, 108px) 24px', textAlign: 'center' }}>
        <h2 className="bl-h2" style={{ ...sectionH2, margin: '0 auto' }}>
          Nobody has to be<br /><span style={{ color: GOLD_HI }}>the designated driver.</span>
        </h2>
        <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.55, margin: '18px auto 0', maxWidth: 520 }}>
          Grab a seat for this weekend. $20, the whole night, back to where you started.
        </p>
        <div style={{ marginTop: 30 }}>
          <Link href="/events" style={{ ...primaryCtaLg, padding: '17px 34px', fontSize: 17 }}>Book a seat</Link>
        </div>

        {/* Sponsor strip — quiet, at the very bottom where a B2B ask belongs */}
        <div style={{ marginTop: 'clamp(56px, 8vw, 92px)' }}>
          <div style={{ color: INK_MUTE, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
            Backed by Jacksonville businesses
          </div>
          <div className="bl-sponsors">
            {SPONSORS.map(s => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" title={s.name} className="bl-sponsor">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.logo} alt={s.name} loading="lazy" />
              </a>
            ))}
          </div>
          <Link href="/sponsors" style={{ color: INK_DIM, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            Put your brand on the Loop &rarr;
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ============================== Primitives =============================== */

const sectionH2 = {
  color: INK, fontSize: 'clamp(28px, 4.6vw, 48px)', fontWeight: 800,
  letterSpacing: '-0.025em', lineHeight: 1.05, margin: '14px 0 0', maxWidth: 620,
}

const heroPill = {
  display: 'inline-flex', alignItems: 'center', gap: 9,
  padding: '8px 15px', borderRadius: 999, border: `1px solid rgba(212,163,51,0.35)`,
  background: 'rgba(10,10,11,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  color: GOLD_HI, fontSize: 11.5, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
}

const timelineNum = {
  flex: '0 0 auto', width: 44, height: 44, borderRadius: 13,
  border: `1px solid rgba(212,163,51,0.45)`,
  background: 'linear-gradient(160deg, rgba(212,163,51,0.18), rgba(212,163,51,0.04))',
  color: GOLD_HI, fontSize: 15, fontWeight: 800,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

function LandingStyles() {
  return (
    <style>{`
      /* --- hero footage --- */
      .bl-hero-media {
        position: absolute; inset: 0; overflow: hidden;
        background-size: cover; background-position: center 45%;
      }
      .bl-hero-video {
        width: 100%; height: 100%; object-fit: cover; display: block;
        /* Slight lift so the footage doesn't fight the headline for contrast. */
        filter: saturate(1.05) contrast(1.02);
      }
      /* Someone who asked their OS for less motion gets the still frame. */
      @media (prefers-reduced-motion: reduce) {
        .bl-hero-video { display: none; }
      }

      /* --- section 2: asymmetric split --- */
      .bl-night { display: grid; grid-template-columns: 1fr; gap: 48px; }
      .bl-night-aside { display: grid; gap: 16px; align-content: start; }
      @media (min-width: 940px) {
        .bl-night { grid-template-columns: 1.15fr 0.85fr; gap: 72px; align-items: center; }
      }

      /* Bar tiles live in ./BarTiles.jsx — shared with /bars and /about. */

      /* --- section 4: merch --- */
      .bl-merch {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 14px; margin-top: 38px;
      }
      .bl-merch-tile {
        position: relative; display: block; border-radius: 16px; overflow: hidden;
        background: linear-gradient(180deg, #17171c, #0f0f12);
        border: 1px solid rgba(255,255,255,0.07); text-decoration: none;
        transition: transform .35s cubic-bezier(.2,.7,.3,1), border-color .35s;
      }
      .bl-merch-tile:hover { transform: translateY(-4px); border-color: rgba(212,163,51,0.45); }
      .bl-merch-tile img { width: 100%; height: 250px; object-fit: cover; display: block; }
      .bl-merch-meta {
        display: flex; align-items: center; justify-content: space-between;
        padding: 13px 16px; border-top: 1px solid rgba(255,255,255,0.06);
      }

      /* FAQ styling lives in ./Faq.jsx — shared with /about. */

      /* --- sponsor strip --- */
      .bl-sponsors {
        display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;
        margin: 20px auto 22px; max-width: 900px;
      }
      .bl-sponsor {
        width: 62px; height: 62px; border-radius: 12px; background: #f4f2ec;
        display: grid; place-items: center; padding: 8px; overflow: hidden;
        opacity: .72; transition: opacity .3s, transform .3s;
      }
      .bl-sponsor:hover { opacity: 1; transform: translateY(-3px); }
      .bl-sponsor img { max-width: 100%; max-height: 100%; object-fit: contain; }
    `}</style>
  )
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
