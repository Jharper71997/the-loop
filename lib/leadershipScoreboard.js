// Money formatter shared by the leadership pages. The scoreboard this file was
// named for is gone; only the formatter is still imported.
export function formatCents(cents) {
  if (cents == null) return '—'
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1000) {
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
