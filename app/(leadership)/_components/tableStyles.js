// Shared table cell styles — kills the half-dozen divergent copies of these
// objects across the leadership pages. Consumed by DataTable, but pages that
// hand-roll a <table> can import these too.

export const MONO = '"JetBrains Mono", ui-monospace, monospace'

export const th = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#9c9ca3',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #2a2a31',
  whiteSpace: 'nowrap',
}

export const td = {
  padding: '12px',
  color: '#e8e8ea',
  verticalAlign: 'top',
  borderBottom: '1px solid #2a2a31',
}

export const tableWrap = {
  background: 'linear-gradient(180deg, #121216, #0d0d10)',
  border: '1px solid #2a2a31',
  borderRadius: 8,
  overflow: 'hidden',
}
