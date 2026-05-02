export function normalizePhone(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null

  const startsWithPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  // E.164 allows 7-15 digits. Only accept non-US formats when the caller
  // explicitly typed a leading '+', otherwise short digit strings (Ticket
  // Tailor sometimes ships an 8-digit truncated phone like "50984205") slip
  // through as bogus "+50984205" values that look valid but fail SMS.
  if (startsWithPlus && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`
  }
  return null
}
