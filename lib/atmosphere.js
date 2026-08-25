// Atmosphere: the layer that stops #0a0a0b reading as a flat dead field.
//
// The first pass at this site was black rectangles on black, and it looked it.
// Flat fills have no light in them, so every section landed with the same
// weight and the whole page felt like one long box. These primitives add the
// three things a dark page needs to feel lit rather than empty:
//
//   1. LIGHT   — warm gold pooling in specific places, not one static hero glow
//   2. GRAIN   — a little noise so large dark areas have tooth instead of banding
//   3. EDGES   — gradient-lit borders that catch light on one side, rather than
//                a uniform 1px rgba box outline on all four
//
// Everything here is a plain style object or a data: URI, so it drops into the
// existing inline-style idiom with no CSS file and no Tailwind.

import { GOLD, SURFACE, LINE, PAPER, PAPER_HI, PAPER_LINE } from './marketingTheme'

// --- Grain -----------------------------------------------------------------
// Inline SVG fractal noise as a data: URI. Tiny, no network request, and it
// tiles seamlessly. Opacity stays very low — you should feel it, not see it.
const GRAIN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.55'/></svg>`
export const GRAIN_URI = `url("data:image/svg+xml,${GRAIN_SVG.replace(/#/g, '%23').replace(/"/g, "'")}")`

// Full-bleed grain overlay. Drop as an aria-hidden sibling inside a
// position:relative parent; keep pointerEvents none so it never eats clicks.
export const grainOverlay = {
  position: 'absolute',
  inset: 0,
  backgroundImage: GRAIN_URI,
  opacity: 0.5,
  mixBlendMode: 'overlay',
  pointerEvents: 'none',
}

// --- Light -----------------------------------------------------------------
// Gold pooling from a named direction. Used to make consecutive sections feel
// lit from different angles instead of identical.
export function lightPool(where = 'top', strength = 0.14) {
  const at = {
    top: '50% -10%',
    'top-left': '12% -10%',
    'top-right': '88% -10%',
    left: '-5% 40%',
    right: '105% 40%',
    bottom: '50% 110%',
  }[where] || '50% -10%'
  return `radial-gradient(900px 460px at ${at}, rgba(212,163,51,${strength}), transparent 62%)`
}

// A scrim that makes white text legible over a photograph while keeping the
// image readable. Heavier at the bottom-left where copy usually sits.
// Tracks TONES.void rather than pure black, so a hero's dark side blends into
// the page instead of reading as a darker rectangle stuck on top of it.
export const photoScrim =
  'linear-gradient(105deg, rgba(18,18,20,0.94) 0%, rgba(18,18,20,0.80) 38%, rgba(18,18,20,0.42) 68%, rgba(18,18,20,0.62) 100%), ' +
  'radial-gradient(700px 420px at 18% 78%, rgba(212,163,51,0.20), transparent 68%)'

// Softer scrim for smaller photo tiles (bar signs), so their real colour shows.
export const tileScrim =
  'linear-gradient(180deg, rgba(18,18,20,0.15) 0%, rgba(18,18,20,0.55) 55%, rgba(18,18,20,0.92) 100%)'

// --- Edges -----------------------------------------------------------------
// A card whose border catches light along the top edge and fades toward the
// bottom, instead of a flat outline. Two-layer background trick: the gradient
// paints the "border", the inset panel covers everything but 1px of it.
export function litCard({ radius = 18, from = 'rgba(212,163,51,0.34)', tint = 0.55 } = {}) {
  return {
    position: 'relative',
    borderRadius: radius,
    padding: 1,
    background: `linear-gradient(160deg, ${from}, rgba(255,255,255,0.05) 28%, rgba(255,255,255,0.02) 70%)`,
    boxShadow: `0 26px 60px rgba(0,0,0,${tint}), 0 2px 0 rgba(255,255,255,0.02) inset`,
  }
}

// The inner surface that sits inside litCard.
export function litCardInner({ radius = 17, pad = 24, bg = SURFACE } = {}) {
  return {
    position: 'relative',
    borderRadius: radius,
    padding: pad,
    height: '100%',
    background: `linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0) 42%), ${bg}`,
    overflow: 'hidden',
  }
}

// --- Section rhythm --------------------------------------------------------
// Sections should not all be the same value. `tone` shifts the base so
// consecutive bands read as different rooms rather than one endless wall.
// Lifted graphite, not pure black (Jacob's call 2026-08-05). Same neutral hue,
// raised off zero so the page reads as lit rather than as a void. The four
// steps stay ~6-8 points apart so consecutive bands still separate.
export const TONES = {
  void: '#15151a',      // deepest — for photo sections where the image carries
  base: '#1b1b21',      // the marketing base
  raised: '#24242b',    // one step up, for content-dense bands
  panel: '#2e2e36',     // highest dark step
  // The light end of the same rhythm (Jacob, 2026-08-25 — "make it brighter, i
  // dont want it all black"). A band on `paper` must flip its OWN text colours
  // to ON_PAPER/ON_PAPER_DIM and its gold to GOLD_INK; the ink tokens are for
  // dark bands and will render white-on-cream if a band changes tone without
  // them. Nothing here is a theme switch — it is picked per band.
  paper: PAPER,
  paperHi: PAPER_HI,
}

// True when a band tone is one of the light ones — so a shared component can
// pick its own text colours from the tone it was handed instead of every
// caller passing a second `dark` flag that can drift out of sync with it.
export function isPaper(tone) {
  return tone === 'paper' || tone === 'paperHi'
}

// A hairline that fades out at both ends — separates sections without drawing
// a hard box around them.
export const fadeRule = {
  height: 1,
  border: 0,
  margin: 0,
  background: `linear-gradient(90deg, transparent, ${LINE} 18%, rgba(212,163,51,0.22) 50%, ${LINE} 82%, transparent)`,
}

// Gold text underline/accent used on hero words.
export const goldUnderline = {
  backgroundImage: `linear-gradient(90deg, ${GOLD}, rgba(212,163,51,0))`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: '0 100%',
  backgroundSize: '100% 3px',
  paddingBottom: 4,
}

// --- Paper -----------------------------------------------------------------
// The light-band equivalents of lightPool / grainOverlay / litCard. They are
// separate functions rather than a `dark` flag on the originals because none of
// the tricks survive the flip: a white-alpha lit edge is invisible on cream, a
// grain that lightens turns a light band chalky, and a shadow tuned for a black
// page reads as soot on paper. Same three ideas — light, tooth, edges — rebuilt
// for the other end of the value scale.

// Warm sun pooling instead of gold glow. On a light band, gold at a low alpha
// reads as daylight falling across the page rather than as a coloured wash, so
// it can run stronger than lightPool without looking tinted.
export function paperWash(where = 'top', strength = 0.2) {
  const at = {
    top: '50% -10%',
    'top-left': '10% -12%',
    'top-right': '90% -12%',
    left: '-6% 38%',
    right: '106% 38%',
    bottom: '50% 112%',
  }[where] || '50% -10%'
  return (
    `radial-gradient(1000px 520px at ${at}, rgba(212,163,51,${strength}), transparent 64%), ` +
    `radial-gradient(760px 400px at ${at === '50% -10%' ? '20% 100%' : '50% 108%'}, rgba(23,23,26,0.05), transparent 62%)`
  )
}

// Grain that MULTIPLIES rather than overlays. Overlay blending lightens the
// dark half of the noise, which on cream shows up as chalk dust; multiply only
// ever darkens, so it lands as paper tooth. It also has to be far weaker than
// the dark-band grain — noise is much more visible on a light field.
export const paperGrain = {
  position: 'absolute',
  inset: 0,
  backgroundImage: GRAIN_URI,
  opacity: 0.17,
  mixBlendMode: 'multiply',
  pointerEvents: 'none',
}

// A card ON paper. The lift comes from a real shadow rather than a lit edge —
// on a light band the eye reads elevation from the shadow, and the gradient
// "border" trick that carries litCard is simply invisible up here.
export function paperCard({ radius = 18, lift = 1 } = {}) {
  return {
    position: 'relative',
    borderRadius: radius,
    background: PAPER_HI,
    border: `1px solid ${PAPER_LINE}`,
    boxShadow: `0 ${Math.round(2 * lift)}px ${Math.round(4 * lift)}px rgba(23,23,26,0.04), ` +
               `0 ${Math.round(16 * lift)}px ${Math.round(34 * lift)}px rgba(23,23,26,0.09)`,
  }
}

// A hairline for light bands. Same fade-at-both-ends idea as fadeRule, in ink.
export const paperRule = {
  height: 1,
  border: 0,
  margin: 0,
  background: `linear-gradient(90deg, transparent, ${PAPER_LINE} 18%, rgba(212,163,51,0.55) 50%, ${PAPER_LINE} 82%, transparent)`,
}
