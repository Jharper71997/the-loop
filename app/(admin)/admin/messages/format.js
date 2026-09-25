// Display helpers shared by the inbox list and the thread view.

const TZ = 'America/New_York'

export function prettyPhone(e164) {
  const d = String(e164 || '').replace(/\D/g, '')
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  return e164 || ''
}

// URL segment for a thread: digits only, so no "+" to escape.
export function phoneSlug(e164) {
  return String(e164 || '').replace(/\D/g, '')
}

export function contactName(c) {
  if (!c) return null
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || null
}

// "9:14 PM" today, "Fri 9:14 PM" this week, "Sep 12" older. `nowMs` comes from
// serverNow() so render stays pure.
export function shortWhen(iso, nowMs) {
  if (!iso) return ''
  const d = new Date(iso)
  const ageH = (nowMs - d.getTime()) / 36e5
  if (ageH < 20) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  if (ageH < 24 * 6) return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })
}

export function fullWhen(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ,
  })
}

// Outbound status as a badge: [label, tone]
export function statusBadge(status) {
  switch (status) {
    case 'delivered': return ['delivered', 'green']
    case 'undelivered': return ['not delivered', 'red']
    case 'blocked': return ['blocked', 'red']
    case 'failed': return ['failed', 'red']
    case 'sent': return ['sent', 'grey']
    default: return [status || 'sent', 'grey']
  }
}
