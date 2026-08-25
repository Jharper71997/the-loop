// Scroll motion for the marketing site.
//
// The site had no reaction to scrolling at all: every band was already fully
// painted before it entered the viewport, so a long page like /about read as
// one static wall you dragged past. This adds the missing beat — a section
// lifts and resolves as it comes up.
//
// CSS-only, on purpose. The obvious build is an IntersectionObserver that sets
// opacity:0 and then reveals, but that puts "the content is invisible" in the
// hands of JavaScript on the pages that sell tickets: any hydration failure,
// any blocked bundle, and the rider is looking at an empty screen. It also
// flashes, because a client effect can only hide things AFTER first paint.
//
// Scroll-driven animations invert the risk. Where `animation-timeline` is
// supported the section animates against its own view progress with no JS and
// no observer; where it isn't, the @supports block never applies, nothing is
// ever hidden, and the page renders exactly as it does today. The failure mode
// is "no animation", never "no content".
//
// Attach with the exported prop objects rather than raw strings, so a typo in
// an attribute name can't silently turn the effect off on one page:
//
//   <div {...reveal()}>            a section that lifts in
//   <div {...reveal(2)}>           the same, arriving slightly later
//   <div {...revealGroup()}>       a grid whose children stagger themselves
//
// RESTRAINT. One idea: things arrive from slightly below and settle. 14px and
// a short curve — enough to feel alive on a phone, not enough to fight the
// reading. No horizontal slides, no scale, no rotation, nothing that moves
// while you are trying to read it: every animation is finished by the time the
// element is properly on screen. Riders open these pages outside a bar, one
// handed, half distracted.

// Where the animation runs. `entry-crossing 0% cover 32%` finishes the move
// while the element is still entering, so nothing animates under the reader's
// eye once it's settled in the middle of the screen.
const RANGE = 'entry 10% cover 34%'

export const REVEAL_CSS = `
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    [data-reveal] {
      animation: bl-rise linear both;
      animation-timeline: view();
      animation-range: ${RANGE};
    }
    [data-reveal="1"] { animation-range: entry 6% cover 37%; }
    [data-reveal="2"] { animation-range: entry 2% cover 40%; }
    [data-reveal="3"] { animation-range: entry 0% cover 43%; }
    /* A grid staggers its own children so tiles arrive as a run rather than
       all at once. Capped at 6 — past that the last tile feels broken, not
       choreographed. */
    [data-reveal-group] > * {
      animation: bl-rise linear both;
      animation-timeline: view();
      animation-range: ${RANGE};
    }
    [data-reveal-group] > *:nth-child(2)  { animation-range: entry 6%  cover 34%; }
    [data-reveal-group] > *:nth-child(3)  { animation-range: entry 2%  cover 34%; }
    [data-reveal-group] > *:nth-child(4)  { animation-range: entry 0%  cover 36%; }
    [data-reveal-group] > *:nth-child(5)  { animation-range: entry 0%  cover 38%; }
    [data-reveal-group] > *:nth-child(n+6){ animation-range: entry 0%  cover 40%; }

    /* Depth on the hero photograph: the image drifts a little slower than the
       page. Only the background layer moves — never the headline over it. */
    [data-parallax] {
      animation: bl-drift linear both;
      animation-timeline: view();
      animation-range: cover;
    }
  }
}

@keyframes bl-rise {
  from { opacity: 0; transform: translate3d(0, 14px, 0); }
  to   { opacity: 1; transform: none; }
}

@keyframes bl-drift {
  from { transform: translate3d(0, -3%, 0) scale(1.06); }
  to   { transform: translate3d(0, 3%, 0) scale(1.06); }
}
`

// A section that lifts in. `order` nudges it later so two things in the same
// band don't arrive stacked on top of each other. The delay is expressed as an
// attribute value matched in CSS rather than an inline style, because
// `animation-range` is new enough that not every React version passes it
// through the style object intact — an attribute selector always lands.
export function reveal(order = 0) {
  return { 'data-reveal': order ? String(Math.min(3, order)) : '' }
}

// A container whose direct children stagger themselves.
export function revealGroup() {
  return { 'data-reveal-group': '' }
}

// The hero image layer. Scale is baked into the keyframes so the drift never
// exposes an edge.
export const parallax = { 'data-parallax': '' }

/* ========================= CINEMATIC SCROLL =============================
   The landing page's two big scroll moments, after Jacob pointed at
   landonorris.com and asked for something like it.

   Both are built the same way and for the same reason as the reveal above:
   the whole effect lives inside `@supports (animation-timeline: view())`, so
   a browser that can't drive animations from scroll position gets the plain
   document — the hero as it always was, the bars as a swipeable row. Nothing
   is ever pinned or translated by a browser that can't also animate it back,
   which is the failure mode that makes these effects dangerous: a stuck
   panel you can't scroll past is worse than no effect at all.

   1. PINNED HERO. The hero holds still and the video pushes in and dims
      while the copy lifts away, then the next section rides up over it. The
      pin lasts 70vh of scroll and then releases, so the video isn't left
      compositing behind the entire page.

   2. THE BAR RAIL. Eight partner bars laid out sideways, moved by vertical
      scroll — the one moment on the page that behaves like a showcase
      instead of a grid. Without support it's an ordinary horizontal
      scroller with snap points, which is a perfectly good phone control.

   translateX uses `calc(-100% + 100vw)` so the track's right edge lands at
   the viewport's right edge no matter how many bars there are — the count
   comes from the database and must never be baked into the CSS.
   ======================================================================== */

export const CINEMATIC_CSS = `
.bl-hero-pin { position: relative; }

/* The hero position lives here, NOT in the component's inline style — an
   inline declaration would beat the @supports rule below and the hero would
   silently never pin. This is the fallback value; the pinned case overrides it. */
.bl-hero { position: relative; }

.bl-scroll-cue {
  display: none;
  position: absolute;
  left: 50%;
  /* 88px, not 26px. The hero is min-height:100vh but at rest it starts BELOW
     the site header, so its last ~70px sit under the fold and a cue pinned to
     the bottom edge is invisible at scroll 0 — the one moment it exists for.
     This clears the header at rest and still reads as "bottom of the hero"
     once the pin takes over and the section is flush with the viewport. */
  bottom: 88px;
  transform: translateX(-50%);
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(10,10,11,0.4);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #f0c24a;
  pointer-events: none;
  z-index: 2;
}
.bl-scroll-cue span { display: flex; }

/* Fallback shape: a heading with an ordinary horizontal scroller under it.
   The scrolling lives on .bl-rail-viewport, never on .bl-rail-stick, so the
   heading can't slide away sideways with the cards. */
.bl-rail-stick {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(22px, 4vh, 40px);
  padding: clamp(28px, 5vw, 56px) 0;
}
.bl-rail-viewport {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.bl-rail-viewport::-webkit-scrollbar { display: none; }
.bl-rail-track {
  display: flex;
  gap: 16px;
  padding: 0 24px;
  width: max-content;
}
.bl-rail-card { scroll-snap-align: center; flex: 0 0 auto; }
.bl-rail-prog { display: none; }

@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    /* ---- 1. pinned hero ---- */
    .bl-hero-pin {
      height: 140vh;
      view-timeline: --bl-hero block;
    }
    .bl-hero-pin > .bl-hero {
      position: sticky;
      top: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
    }
    .bl-hero-pin .bl-hero-media {
      animation: bl-hero-push linear both;
      animation-timeline: --bl-hero;
      animation-range: contain;
    }
    .bl-hero-pin .bl-hero-copy {
      animation: bl-hero-lift linear both;
      animation-timeline: --bl-hero;
      animation-range: contain;
    }

    /* The cue only exists where the pin does — it's an instruction, and an
       instruction the page can't honour is worse than none. */
    .bl-scroll-cue {
      display: flex;
      animation: bl-cue-out linear both;
      animation-timeline: --bl-hero;
      animation-range: contain 0% contain 18%;
    }
    .bl-scroll-cue span { animation: bl-cue-bob 1.9s ease-in-out infinite; }

    /* ---- 2. the bar rail ---- */
    .bl-rail-pin {
      height: 300vh;
      view-timeline: --bl-rail block;
    }
    .bl-rail-stick {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 0;
    }
    .bl-rail-viewport {
      overflow: hidden;
      scroll-snap-type: none;
    }
    .bl-rail-track {
      animation: bl-rail-slide linear both;
      animation-timeline: --bl-rail;
      animation-range: contain;
    }

    /* How far through the route you are. It only exists where the pin does —
       a progress bar that can never fill is a broken-looking decoration. */
    .bl-rail-prog { display: block; }
    .bl-rail-prog-fill {
      animation: bl-rail-prog linear both;
      animation-timeline: --bl-rail;
      animation-range: contain;
    }

    /* Parallax INSIDE each card: the sign drifts the opposite way to the
       track, so it lags the frame and the card reads as a window onto the
       artwork instead of a flat tile sliding past. One rule for every card —
       no per-index ranges, so the bar count still comes from the database and
       is never baked into the CSS. */
    .bl-rail-art img {
      animation: bl-rail-drift linear both;
      animation-timeline: --bl-rail;
      animation-range: contain;
    }
  }
}

/* The media must NOT fade far. The pin releases with the hero still occupying
   the top of the viewport for a moment before the next section covers it, and
   a hero dimmed to 0.4 reads as a blank dark band in that gap — an empty
   screen, not an effect. It pushes in and settles a little; it never leaves. */
@keyframes bl-hero-push {
  from { transform: scale(1);    opacity: 1; }
  to   { transform: scale(1.12); opacity: 0.86; }
}
/* The copy SOFTENS, it does not leave.
   The first build lifted it to opacity 0, which looked right at the moment it
   happened and was wrong everywhere after: a 100vh hero always takes a full
   viewport to scroll away once the pin releases, and with the headline already
   animated to zero (fill: both holds it there) that whole viewport was bare
   video with nothing on it. Ending at 0.72 keeps a legible hero on screen for
   its entire exit while still reading as the copy receding behind the shot. */
@keyframes bl-hero-lift {
  from { transform: translate3d(0, 0, 0);     opacity: 1; }
  to   { transform: translate3d(0, -48px, 0); opacity: 0.72; }
}
@keyframes bl-cue-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes bl-cue-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(5px); }
}
@keyframes bl-rail-slide {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(calc(-100% + 100vw), 0, 0); }
}
/* Starts at a sliver rather than zero so the bar is visibly a bar from the
   first frame, not a line that appears out of nowhere. */
@keyframes bl-rail-prog {
  from { transform: scaleX(0.04); }
  to   { transform: scaleX(1); }
}
@keyframes bl-rail-drift {
  from { transform: translate3d(-4%, 0, 0) scale(1.07); }
  to   { transform: translate3d(4%, 0, 0)  scale(1.07); }
}

/* ---- the ticker ----
   The one piece of motion here that is NOT tied to scroll position. Everything
   else on the page only moves while you do, which means a page sitting still
   is completely dead — and the moment right after the hero pin releases is
   exactly where that shows. A slow marquee of the offer gives the page a pulse
   and doubles as the plainest statement of what you get.

   Duration is long on purpose (a fast marquee is a banner ad), it pauses on
   hover so you can actually read a line you care about, and it stops dead for
   anyone who asked their OS for less motion — a permanently-moving strip is
   the single worst thing on a page for motion sensitivity. */
.bl-ticker { overflow: hidden; display: flex; }
.bl-ticker-track { display: flex; width: max-content; }
@media (prefers-reduced-motion: no-preference) {
  .bl-ticker-track { animation: bl-ticker 46s linear infinite; }
  .bl-ticker:hover .bl-ticker-track { animation-play-state: paused; }
}
@keyframes bl-ticker {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
`

// Everything the marketing site needs, injected once in RiderChrome.
export const SITE_MOTION_CSS = REVEAL_CSS + CINEMATIC_CSS
