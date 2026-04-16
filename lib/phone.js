export function normalizePhone(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null

  const startsWithPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (startsWithPlus) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}
