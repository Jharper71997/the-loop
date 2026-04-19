import twilio from 'twilio'
import { appUrl } from './stripe'

let _client = null

function client() {
  if (_client) return _client
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing')
  _client = twilio(sid, token)
  return _client
}

export async function sendSms(to, body) {
  if (!to) return { skipped: 'no_to' }
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!from) throw new Error('TWILIO_PHONE_NUMBER missing')
  return client().messages.create({ body, from, to })
}

// Booking confirmation SMS template.
//   buyer: { name }
//   event: { name, event_date, pickup_time }
//   waiverLink: optional URL — included only if rider still owes a signature.
export async function sendBookingConfirmation(to, { buyer, event, waiverLink }) {
  const dateLabel = formatDate(event.event_date)
  const time = event.pickup_time ? ` at ${formatTime(event.pickup_time)}` : ''
  const trackUrl = `${appUrl()}/track`

  let body = `Brew Loop: you're on the shuttle ${dateLabel}${time}. Track it live: ${trackUrl}`
  if (waiverLink) {
    body += `\n\nPlease sign your waiver before pickup: ${waiverLink}`
  }
  return sendSms(to, body)
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
