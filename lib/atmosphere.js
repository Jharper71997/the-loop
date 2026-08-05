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

import { GOLD, SURFACE, LINE } from './marketingTheme'

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
export const photoScrim =
  'linear-gradient(105deg, rgba(10,10,11,0.94) 0%, rgba(10,10,11,0.80) 38%, rgba(10,10,11,0.42) 68%, rgba(10,10,11,0.62) 100%), ' +
  'radial-gradient(700px 420px at 18% 78%, rgba(212,163,51,0.20), transparent 68%)'

// Softer scrim for smaller photo tiles (bar signs), so their real colour shows.
export const tileScrim =
  'linear-gradient(180deg, rgba(10,10,11,0.15) 0%, rgba(10,10,11,0.55) 55%, rgba(10,10,11,0.92) 100%)'

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
export const TONES = {
  void: '#08080a',      // deepest — for photo sections where the image carries
  base: '#0a0a0b',      // the brand black
  raised: '#101013',    // one step up, for content-dense bands
  panel: '#131317',     // highest, for the merch / product band
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
