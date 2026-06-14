export const rideChipStyle = {
  background: '#2a2316',
  color: '#f0c040',
  border: '1px solid #3a3220',
  fontSize: '12px',
  fontWeight: 500,
  padding: '3px 8px',
  borderRadius: '10px',
  whiteSpace: 'nowrap',
}

export function formatEventDate(iso) {
  if (!iso) return null
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}
