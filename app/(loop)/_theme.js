// Shared palette + style primitives for "The Loop" (Marines) surfaces.
//
// Dark base with a RED accent — the accent ties to the fixed "red line" route.
// Matches Brew Loop polish without any bar/alcohol cues (under-21 riders are
// aboard). Re-theme the whole product by editing here, not five files.
//
// No "military"/"Camp Lejeune"-heavy copy belongs in (loop) UI — keep ID
// language to a quiet "ID required to ride."

export const C = {
  BG: '#14181c',
  SURFACE: '#1a2027',
  SURFACE_HI: '#1f262e',
  INK: '#eef1f3',
  INK_DIM: '#9aa3ab',
  RED: '#e5484d',
  RED_HI: '#f2585d',
  RED_DEEP: '#c93b40',
  WARM: '#c9ccd1', // neutral warm-gray (replaces the old olive/sand accent)
  LINE: 'rgba(255,255,255,0.10)',
}

export const card = {
  borderRadius: 14,
  background: C.SURFACE,
  border: `1px solid ${C.LINE}`,
}

export const eyebrow = {
  color: C.RED,
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
  background: `linear-gradient(180deg, ${C.RED_HI}, ${C.RED})`,
  color: '#fff',
  fontWeight: 800,
  textDecoration: 'none',
  fontSize: 15,
  boxShadow: '0 10px 24px rgba(229,72,77,0.30)',
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
