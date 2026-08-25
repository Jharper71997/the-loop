// Shared marketing/design tokens for the Brew Loop public website.
//
// The-loop styles the public surface with `:root` CSS vars + inline style
// objects (see app/(external)/marines/page.js) — no Tailwind. This module is
// the ONE place the marketing palette + reusable style objects live, so the new
// site and the reskinned rider pages stay visually coherent and refactors are
// drop-in. Plain module (no 'use client') → importable from server AND client
// components.

// Palette — mirrors globals.css :root, softened for marketing (external-shell).
export const GOLD = '#d4a333'
export const GOLD_HI = '#f0c24a'
export const GOLD_DIM = '#8a6a22'
export const INK = '#f5f5f7'
export const INK_DIM = '#b8b8bf'
export const INK_MUTE = '#8a8a92'
// Base is a lifted neutral graphite, not pure black. Jacob's call 2026-08-05:
// #0a0a0b read as a dead void behind the gold, and every section landed with
// the same weight. Same hue, just raised off zero so the page has air.
// (The app shell / admin surfaces keep globals.css --bg; this is marketing.)
export const BG = '#17171a'
export const SURFACE = '#212127'
export const SURFACE_2 = '#292930'

// Text sitting ON gold (buttons, badges) stays near-black — it needs the
// contrast against #d4a333 and must NOT track BG upward.
export const ON_GOLD = '#0a0a0b'
export const LINE = 'rgba(255,255,255,0.08)'
export const LINE_HI = 'rgba(255,255,255,0.14)'
export const GOLD_LINE = 'rgba(212,163,51,0.5)'
export const GOLD_WASH = 'rgba(212,163,51,0.10)'

// ---- Light surfaces -------------------------------------------------------
// Jacob, 2026-08-25: "can we make it brighter, i dont want it all black."
//
// The answer is NOT a light theme. Two of this site's three artwork families
// are built for a dark field and fall apart on cream: the hero is night
// footage, and half the bar signs have black baked into the image (Black Rose,
// Unhinged, Brassa) so on paper they read as black rectangles stuck on a wall.
//
// The merch is the exact opposite — transparent cutouts of people in BLACK
// apparel, which on a near-black panel melt into it and leave the gold badge
// floating on nothing.
//
// So brightness comes from RHYTHM, not from a global flip: the bands whose
// artwork is genuinely better on paper (the timeline, the merch) go light, the
// bands that need night stay dark, and the page alternates. Pick the tone from
// what the picture needs, never to hit a mood.
export const PAPER = '#f2efe7'       // warm bone — the base light band
export const PAPER_HI = '#fbf9f4'    // raised light surface (cards on paper)
export const PAPER_LINE = 'rgba(23,23,26,0.10)'
export const PAPER_LINE_HI = 'rgba(23,23,26,0.20)'
export const ON_PAPER = '#16161a'
export const ON_PAPER_DIM = '#4d4d57'   // 7.3:1 on PAPER
// 5.2:1 on PAPER. It was #76767f, which measured 3.9:1 — under AA for body
// text, and the detail column on /about is set in it at 14.5px. A muted tone on
// a light band has far less room than the same idea on a dark one: INK_MUTE can
// sit 5 steps off white and still pass, the paper equivalent cannot.
export const ON_PAPER_MUTE = '#63636c'

// Brand gold is ~2.3:1 on PAPER — fine as a rule, a fill or a badge, NOT as
// text. Text-weight gold gets its own darker value (measured 4.67:1 on PAPER,
// so it clears AA at body size). Never put GOLD/GOLD_HI on a light band.
export const GOLD_INK = '#8a6410'

// Gradients / glows.
export const GOLD_GRAD = `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`
export const BG_GLOW = 'radial-gradient(120% 80% at 50% 0%, rgba(212,163,51,0.20), transparent 60%), #1e1e22'
export const HERO_GLOW = 'radial-gradient(1000px 520px at 50% -10%, rgba(212,163,51,0.16), transparent 60%)'

// Content widths. Wide enough to fill a desktop monitor (not a narrow centered
// column) while still capping line length on huge screens.
export const MAX_W = 1320
export const MAX_W_NARROW = 820

// ---- Reusable style objects (spread into inline `style={{ ...card }}`) ----

export const card = {
  background: SURFACE,
  border: `1px solid ${LINE}`,
  borderRadius: 16,
}

export const softCard = {
  ...card,
  boxShadow: '0 14px 30px rgba(0,0,0,0.22)',
}

export const eyebrow = {
  color: GOLD,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

export const sectionLabel = { ...eyebrow, paddingLeft: 2 }

export const stepNum = {
  flex: '0 0 auto',
  width: 30,
  height: 30,
  borderRadius: 9,
  border: `1px solid ${GOLD}`,
  color: GOLD_HI,
  fontSize: 14,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export const primaryCta = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '13px 22px',
  borderRadius: 12,
  background: GOLD_GRAD,
  color: ON_GOLD,
  fontWeight: 800,
  fontSize: 15,
  letterSpacing: '0.01em',
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 10px 28px rgba(212,163,51,0.28)',
}

export const primaryCtaLg = {
  ...primaryCta,
  padding: '15px 28px',
  fontSize: 16,
}

export const ghostCta = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '13px 20px',
  borderRadius: 12,
  background: 'transparent',
  color: INK,
  border: `1px solid ${LINE_HI}`,
  fontWeight: 700,
  fontSize: 14,
  textDecoration: 'none',
  cursor: 'pointer',
}

// The secondary button on a light band. ghostCta is a near-white label inside a
// white-alpha outline — both of them disappear on cream, so a paper band that
// reuses it ends up with an invisible second action.
export const ghostCtaPaper = {
  ...ghostCta,
  color: ON_PAPER,
  background: PAPER_HI,
  border: `1px solid ${PAPER_LINE_HI}`,
}

export const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${LINE}`,
  color: INK_DIM,
  fontSize: 12.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

// Small gold "eyebrow with a dot" flourish used on hero/section labels.
export const pulseDot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: GOLD,
  boxShadow: `0 0 10px ${GOLD}`,
  display: 'inline-block',
  flex: '0 0 auto',
}
