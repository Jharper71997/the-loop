// Jville Brew Loop — public landing page.
//
// Rebuilt 2026-08-05 against two pieces of feedback: "too blocky, the black
// looks boring" and "still confusing". Both had the same root cause — eight
// sections that were all `eyebrow + heading + row of identical bordered
// rectangles` on one flat black fill. Nothing looked more important than
// anything else, so nothing guided you anywhere.
//
// Now FIVE beats, each with a genuinely different texture and job:
//
//   1. HERO       pinned footage + scrim + grain         → what this is, book it
//   2. TICKER     a gold marquee of the offer            → colour, and a pulse
//   3. THE NIGHT  timeline + shuttle photo, ON PAPER     → how it works
//   4. THE BARS   pinned rail of real signage, dark      → where it goes
//   5. THE GEAR   merch cutouts ON PAPER + questions     → wear it / book it
//      CLOSER     dark, gold, one ask                    → book it
//
// THE VALUE RHYTHM IS THE POINT (Jacob, 2026-08-25 — "can we make it brighter,
// i dont want it all black"). Bands alternate dark/light, and which way each
// one goes is decided by ITS ARTWORK, never by mood: the hero is night footage
// and the bar signs have black baked into them, so those stay dark; the merch
// shots are cutouts of people in black apparel and the timeline is pure type,
// so those go to paper where they finally have something to sit against. See
// the light-surface block in lib/marketingTheme.js.
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
  GOLD, GOLD_HI, GOLD_INK, INK, INK_DIM, INK_MUTE, LINE_HI, MAX_W,
  ON_PAPER, ON_PAPER_DIM, PAPER_HI, PAPER_LINE,
  primaryCtaLg, ghostCtaPaper, eyebrow, pulseDot,
} from '@/lib/marketingTheme'
import {
  TONES, grainOverlay, lightPool, photoScrim,
  paperCard, paperWash, paperGrain,
} from '@/lib/atmosphere'
import { revealGroup } from '@/lib/motion'
import BrewJsonLd from '../site/BrewJsonLd'
import SocialLinks from '../site/SocialLinks'
import BarRail from './BarRail'
import Ticker from './Ticker'
import Faq from './Faq'

const LANDING_FAQ = FAQ.slice(0, LANDING_FAQ_COUNT)

// Stated as plainly as it can be stated, and derived — the bar count comes from
// the database, never typed into a string.
const TICKER_ITEMS = [
  `${PARTNER_BAR_COUNT} partner bars`,
  'One shuttle all night',
  '$20 a seat',
  'Back where you started',
  'Tracked live',
  'Strictly 21+',
]

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
      <Ticker items={TICKER_ITEMS} label="What a seat gets you" />
      <TheNight />
      <TheBars />
      <TheGear />
      <Closer />
      <LandingStyles />
      {/* Structured data: tells Google the Instagram and Facebook accounts are
          this same business. Rendered once, on the page that ranks. */}
      <BrewJsonLd />
    </main>
  )
}

/* =============================== 1. HERO ================================= */
/* A photograph, not a black box. Copy sits in the dark side of the scrim.   */

function Hero({ next }) {
  return (
    /* The pin wrapper is inert until the browser can actually drive an
       animation from scroll position — see lib/motion.js. Without support it
       has no height of its own and the hero lays out exactly as it always did;
       with support it runs 150vh, the hero sticks for the difference, and the
       next section rides up over it. */
    <div className="bl-hero-pin">
    <section className="bl-hero" style={{ overflow: 'hidden', background: TONES.void }}>
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

      <div className="bl-hero-copy" style={{ position: 'relative', width: '100%', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(72px, 12vw, 148px) 24px clamp(56px, 8vw, 104px)' }}>
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

      {/* Only rendered as visible where the pin exists — an instruction to
          scroll is noise on a hero that doesn't hold. */}
      <div aria-hidden className="bl-scroll-cue">
        <span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </span>
      </div>
    </section>
    </div>
  )
}

function NextLoopChip({ next }) {
  return (
    <Link href="/events" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none',
      padding: '13px 18px', borderRadius: 999,
      background: 'rgba(18,18,21,0.55)', border: `1px solid ${LINE_HI}`,
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

/* ============================= 3. THE NIGHT ============================== */
/* Asymmetric: a vertical timeline on the left, the shuttle floating right.  */
/* Deliberately NOT three matching cards in a row.                           */
/*                                                                           */
/* ON PAPER. This band is type and one photograph — it has no artwork that   */
/* needs a dark field, and it is the page's first real breath after the hero */
/* holds you for 150vh. Every colour in here is the light-band token, NOT    */
/* INK/GOLD_HI: those are white-ish and vanish on cream. Nothing renders     */
/* white-on-white by accident because there is no theme switch to forget —   */
/* the tokens are named for the surface they belong to.                      */

function TheNight() {
  return (
    <section style={{ position: 'relative', background: TONES.paper, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: paperWash('top-right', 0.22) }} />
      <div aria-hidden style={paperGrain} />

      <div className="bl-night" style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(64px, 9vw, 112px) 24px' }}>
        <div>
          <div style={{ ...eyebrow, color: GOLD_INK }}>How a night runs</div>
          <h2 className="bl-h2" style={{ ...sectionH2, color: ON_PAPER }}>
            Three steps, then<br />the night is handled.
          </h2>

          {/* Timeline — one continuous gold line threading the steps. The
              steps stagger themselves in as the band comes up; the group
              helper does the choreography so there is no per-item timing to
              keep in sync. */}
          <ol {...revealGroup()} style={{ listStyle: 'none', margin: '40px 0 0', padding: 0, position: 'relative' }}>
            {STEPS.map((s, i) => {
              const last = i === STEPS.length - 1
              return (
                <li key={s.n} style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                    <span style={timelineNumPaper}>{s.n}</span>
                    {!last && <span aria-hidden style={{ width: 2, flex: 1, minHeight: 30, background: `linear-gradient(180deg, ${GOLD}, rgba(212,163,51,0.22))` }} />}
                  </div>
                  <div style={{ paddingBottom: last ? 0 : 34, maxWidth: 460 }}>
                    <h3 style={{ color: ON_PAPER, fontSize: 'clamp(19px, 2.4vw, 23px)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{s.title}</h3>
                    <p style={{ color: ON_PAPER_DIM, fontSize: 15.5, lineHeight: 1.6, margin: '9px 0 0' }}>{s.sub}</p>
                  </div>
                </li>
              )
            })}
          </ol>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 40 }}>
            <Link href="/events" style={{ ...primaryCtaLg, padding: '15px 26px' }}>Book a seat</Link>
            <Link href="/about" style={{ ...ghostCtaPaper, padding: '15px 24px' }}>Read the full rundown</Link>
          </div>
        </div>

        {/* Shuttle + price, floating */}
        <div className="bl-night-aside">
          {/* This was a stock all-black bus render floated on the panel with
              mixBlendMode:'screen' — a vehicle nobody riding the Loop has ever
              seen. It's now a frame from Jacob's own footage of the actual
              shuttle on a Jacksonville street: white over black, BAR HOP
              SHUTTLE in gold, the roundel in the window. A white-over-black
              vehicle on paper is the shot at its best; on the old dark panel
              the black lower body had nothing to separate it from the page. */}
          <div style={{ ...paperCard({ radius: 20 }), overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/photos/shuttle.jpg"
              alt="The Jville Brew Loop shuttle parked on a street in downtown Jacksonville"
              style={{ width: '100%', display: 'block', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 19 }}
            />
          </div>

          <div style={{ ...paperCard({ radius: 20 }), padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ color: ON_PAPER, fontSize: 'clamp(40px, 6vw, 54px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>$20</span>
              <span style={{ color: ON_PAPER_DIM, fontSize: 16, fontWeight: 600 }}>a seat</span>
            </div>
            <p style={{ color: ON_PAPER_DIM, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 0' }}>
              Covers your whole night. No surge, no per-ride math, and it brings you back
              to the same spot you started.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================== 4. THE BARS ============================== */
/* The colour moment — real signage, and the page's one showcase.            */
/*                                                                           */
/* STAYS DARK, and that is a decision rather than an oversight: half of these */
/* signs have black baked into the image (Black Rose, Unhinged, Brassa), so   */
/* on a light band they read as black rectangles stuck on a cream wall. The   */
/* artwork picks the tone.                                                   */
/*                                                                           */
/* NOTE the missing `overflow: hidden` on this section. It used to be here    */
/* and it CANNOT come back: overflow:hidden on any ancestor makes that        */
/* ancestor the scrollport for `position: sticky` and for `view-timeline`, so */
/* the pinned rail inside would simply never pin and never move. The light    */
/* pool it was containing is `inset: 0` and doesn't overflow anyway.          */

function TheBars() {
  return (
    /* `raised`, not `void`. The card plates went near-black so the signs with
       black baked into them would blend into their own frames — which means
       the BAND has to be the lighter of the two or the posters disappear into
       it. Dark section, lit stage, black objects on it. */
    <section style={{ position: 'relative', background: TONES.raised }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-left', 0.2) }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('right', 0.12) }} />

      {/* Full bleed on purpose — the rail travels the width of the screen, and
          it carries its own heading so the label stays on screen while it's
          pinned. */}
      <div style={{ position: 'relative' }}>
        <BarRail
          bars={PUBLIC_PARTNER_BARS}
          eyebrow="Where it goes"
          title="The best spots in town, on one route."
        />
      </div>

      <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: '0 24px clamp(64px, 9vw, 112px)' }}>
        <p style={{ color: INK_MUTE, fontSize: 14, lineHeight: 1.6, margin: '26px 0 0', maxWidth: 620 }}>
          The route rotates weekend to weekend, and Friday can differ from Saturday. The night
          you book always lists its exact stops.
        </p>
      </div>
    </section>
  )
}

/* ============================== 5. THE GEAR ============================== */
/* Merch as real photography, plus the questions people still have.          */
/*                                                                           */
/* ON PAPER, and this is the band that most needed it. The shots are          */
/* transparent cutouts of people wearing BLACK apparel: on the old near-black */
/* panel the garment melted into the background and left the gold chest badge */
/* floating on nothing, which is why the merch never looked like it was for   */
/* sale. On paper the garment has an edge and the badge reads as printed on   */
/* fabric. The tiles are `contain`, not `cover` — cover was cropping the      */
/* models to a horizontal band through the torso.                            */

function TheGear() {
  return (
    <section style={{ position: 'relative', background: TONES.paper, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: paperWash('left', 0.18) }} />
      <div aria-hidden style={paperGrain} />

      <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(64px, 9vw, 112px) 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ ...eyebrow, color: GOLD_INK }}>Merch</div>
            <h2 className="bl-h2" style={{ ...sectionH2, color: ON_PAPER }}>Wear the gold badge.</h2>
            <p style={{ color: ON_PAPER_DIM, fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.55, margin: '14px 0 0' }}>
              Black-and-gold Brew Loop gear. Ships to your door, or grab it on the shuttle.
            </p>
          </div>
          <Link href="/merch" style={{ ...ghostCtaPaper, padding: '13px 22px' }}>Shop merch</Link>
        </div>

        <div className="bl-merch" {...revealGroup()}>
          {MERCH_SHOTS.map((m, i) => (
            <Link key={i} href="/merch" className="bl-merch-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={m.label} loading="lazy" />
              <span className="bl-merch-meta">
                <span style={{ color: ON_PAPER, fontSize: 14.5, fontWeight: 700 }}>{m.label}</span>
                <span style={{ color: GOLD_INK, fontSize: 14.5, fontWeight: 800 }}>{m.price}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Remaining questions — compact, two columns, not a stack of fat cards */}
        <div style={{ marginTop: 'clamp(48px, 7vw, 80px)' }}>
          <div style={{ ...eyebrow, color: GOLD_INK }}>Before you book</div>
          <Faq items={LANDING_FAQ} tone="paper" />
          <p style={{ margin: '18px 0 0' }}>
            <Link href="/about#faq" style={{ color: GOLD_INK, fontWeight: 700, fontSize: 14.5, textDecoration: 'none' }}>
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
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('bottom', 0.24) }} />
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

        {/* Follow. The socials were only reachable from the footer and
            /contact, which is the wrong place for them: the weekend lineup
            gets posted to Instagram before it exists anywhere else, so the
            ask belongs next to the booking button for the people who came,
            read the whole page, and aren't ready to buy tonight. */}
        <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13 }}>
          <div style={{ color: INK_MUTE, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
            New dates drop on Instagram first
          </div>
          <SocialLinks size={44} />
        </div>

        {/* Sponsor strip — quiet, at the very bottom where a B2B ask belongs */}
        <div style={{ marginTop: 'clamp(56px, 8vw, 92px)' }}>
          <div style={{ color: INK_MUTE, fontSize: 12.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
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
  background: 'rgba(18,18,21,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  color: GOLD_HI, fontSize: 11.5, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
}

// The step marker on a light band. Brand gold is only ~2.3:1 on paper, so the
// numeral itself is GOLD_INK; the gold stays as the ring and the wash, where
// it's decoration and contrast doesn't apply.
const timelineNumPaper = {
  flex: '0 0 auto', width: 44, height: 44, borderRadius: 13,
  border: `1px solid rgba(212,163,51,0.7)`,
  background: 'linear-gradient(160deg, rgba(212,163,51,0.28), rgba(212,163,51,0.10))',
  color: GOLD_INK, fontSize: 15, fontWeight: 800,
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

      /* --- section 3: asymmetric split --- */
      .bl-night { display: grid; grid-template-columns: 1fr; gap: 48px; }
      .bl-night-aside { display: grid; gap: 16px; align-content: start; }
      @media (min-width: 940px) {
        .bl-night { grid-template-columns: 1.15fr 0.85fr; gap: 72px; align-items: center; }
      }

      /* The bar rail lives in ./BarRail.jsx — landing only. The grid it
         replaced here, BarTiles.jsx, still serves /bars and /about. */

      /* --- section 5: merch, on paper --- */
      .bl-merch {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 14px; margin-top: 38px;
      }
      .bl-merch-tile {
        position: relative; display: block; border-radius: 16px; overflow: hidden;
        background: ${PAPER_HI};
        border: 1px solid ${PAPER_LINE}; text-decoration: none;
        box-shadow: 0 2px 4px rgba(23,23,26,0.04), 0 16px 34px rgba(23,23,26,0.09);
        transition: transform .35s cubic-bezier(.2,.7,.3,1), border-color .35s, box-shadow .35s;
      }
      .bl-merch-tile:hover {
        transform: translateY(-5px);
        border-color: rgba(212,163,51,0.6);
        box-shadow: 0 6px 10px rgba(23,23,26,0.05), 0 24px 46px rgba(23,23,26,0.13);
      }
      /* CONTAIN, not cover. These are full-length cutouts on transparency —
         cover cropped them to a band across the chest. */
      .bl-merch-tile img {
        width: 100%; height: 260px; object-fit: contain; display: block;
        padding: 14px 14px 0; box-sizing: border-box;
      }
      .bl-merch-meta {
        display: flex; align-items: center; justify-content: space-between;
        padding: 13px 16px; border-top: 1px solid ${PAPER_LINE};
      }

      /* FAQ styling lives in ./Faq.jsx — shared with /about, tone-aware. */

      /* --- sponsor wall ---
         Was eleven 62px cream squares at 72% opacity, which Jacob called out
         2026-08-25. Three separate things were wrong with it and all three are
         fixed here:

         1. SIZE. At 62px square none of these logos were legible — most of them
            are a wordmark, and a wordmark you can't read is just a smudge. The
            plate is landscape now and big enough to read the name in the art.
         2. PLATE COLOUR. Cream (#f4f2ec) fought every logo. Almost all of this
            artwork is drawn on WHITE, so a cream plate put a visible off-white
            rectangle inside each tile. Pure white makes those logos blend into
            their plate entirely; the two that are drawn on black (Dragon's
            Brew, Dream Entertainment) read as dark badges, which is what they
            actually are. Same principle as the bar signs, other direction.
         3. OPACITY. They were dimmed to .72. These are businesses paying to be
            on this page — do not fade them out to make the layout calmer. */
      /* 730px caps the row at six, so eleven sponsors break 6 + 5. Wider and
         it was seven and four, which reads as a leftover row not a wall. */
      .bl-sponsors {
        display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
        margin: 24px auto 26px; max-width: 730px;
      }
      .bl-sponsor {
        /* Nearly square, because the ARTWORK is: eight of these eleven logos
           are 1:1 lockups, not wordmarks. On the landscape plate this started
           out as, a square logo contained down to 54px and sat in a pool of
           white. Size the plate to the art you actually have. */
        width: 110px; height: 100px; border-radius: 12px; background: #fff;
        /* FLEX, not grid. As a grid the single auto row sized itself to the
           image (grid-template-rows computed to 104px), so the image's own
           height: 100% resolved against the image — circular — and every
           square logo overflowed the 78px plate and got sliced by
           overflow: hidden. A flex container's content height is definite, so
           the percentage has something real to resolve against. */
        display: flex; align-items: center; justify-content: center;
        padding: 12px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 10px 24px rgba(0,0,0,0.35);
        transition: transform .3s cubic-bezier(.2,.7,.3,1), box-shadow .3s;
      }
      .bl-sponsor:hover {
        transform: translateY(-4px);
        box-shadow: 0 18px 38px rgba(0,0,0,0.5);
      }
      /* width/height 100% + contain, NOT max-width/max-height.
         A percentage max-height does not bind on a centred grid item — the item box
         is content-sized, so the percentage has nothing definite to resolve
         against and every square logo rendered at its full 104px width inside
         a 78px plate, where overflow: hidden sliced the top and bottom off
         it. That bug was already here at the old 62px size and was invisible
         only because a square logo in a square plate can't overflow. Sizing
         the box explicitly and letting object-fit letterbox always works. */
      .bl-sponsor img { width: 100%; height: 100%; object-fit: contain; }
      @media (max-width: 560px) {
        .bl-sponsor { width: 94px; height: 86px; padding: 10px; }
      }
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
