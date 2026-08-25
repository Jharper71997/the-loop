// Shared table cell styles — kills the half-dozen divergent copies of these
// objects across the leadership pages. Consumed by DataTable, but pages that
// hand-roll a <table> can import these too.

export const MONO = '"JetBrains Mono", ui-monospace, monospace'

export const th = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#6e6154',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #e8ddc8',
  whiteSpace: 'nowrap',
}

export const td = {
  padding: '12px',
  color: '#17130f',
  verticalAlign: 'top',
  borderBottom: '1px solid #e8ddc8',
}

export const tableWrap = {
  background: 'linear-gradient(180deg, #ffffff, #fdfaf3)',
  border: '1px solid #e8ddc8',
  borderRadius: 8,
  overflow: 'hidden',
}
