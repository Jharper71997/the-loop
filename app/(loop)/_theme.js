// Shared palette + style primitives for "The Loop" (Marines) surfaces.
//
// Dark base with a GOLD accent — matches the Brew Loop gold design system
// exactly. Matches Brew Loop polish without any bar/alcohol cues (under-21
// riders are aboard). Re-theme the whole product by editing here, not five files.
//
// No "military"/"Camp Lejeune"-heavy copy belongs in (loop) UI — keep ID
// language to a quiet "ID required to ride."

export const C = {
  BG: '#0a0a0b',
  SURFACE: '#121216',
  SURFACE_HI: '#16161c',
  INK: '#e8e8ea',
  INK_DIM: '#9c9ca3',
  GOLD: '#d4a333',
  GOLD_HI: '#f0c24a',
  GOLD_DEEP: '#8a6a22',
  WARM: '#c9ccd1', // neutral warm-gray
  LINE: 'rgba(255,255,255,0.10)',
}

export const card = {
  borderRadius: 14,
  background: C.SURFACE,
  border: `1px solid ${C.LINE}`,
}

export const eyebrow = {
  color: C.GOLD,
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

export const sectionLabel = {
  fontSize: 11,
  color: C.WARM,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

export const primaryCta = {
  display: 'inline-block',
  padding: '13px 22px',
  borderRadius: 10,
  background: `linear-gradient(180deg, ${C.GOLD_HI}, ${C.GOLD})`,
  color: '#0a0a0b',
  fontWeight: 800,
  textDecoration: 'none',
  fontSize: 15,
  boxShadow: '0 10px 24px rgba(212,163,51,0.30)',
}

export const ghostCta = {
  display: 'inline-block',
  padding: '12px 18px',
  borderRadius: 999,
  background: 'transparent',
  color: C.INK,
  border: `1px solid ${C.LINE}`,
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: 14,
}
