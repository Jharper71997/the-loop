export const rideChipStyle = {
  background: '#fdf3d9',
  color: '#8a5f0a',
  border: '1px solid #fdf3d9',
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
