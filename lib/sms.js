import { appUrl } from './stripe'

// Outbound SMS via SimpleTexting (https://simpletexting.com). Replaced Twilio
// on 2026-04-20 — Brew Loop's Twilio toll-free never got carrier approval
// (error 30032).
//
// Endpoint: POST https://api-app2.simpletexting.com/v2/api/messages
// Auth:     Authorization: Bearer <SIMPLETEXTING_API_KEY>
// Mode:     SINGLE_SMS_STRICTLY — we never want to split into multiple SMS
//           charges for long copy; if it exceeds one segment SimpleTexting
//           will reject rather than rack up bills.
//
// API surface is unchanged from the old Twilio impl — callers keep using
// sendSms(to, body) and sendBookingConfirmation(to, payload).

const ST_ENDPOINT = 'https://api-app2.simpletexting.com/v2/api/messages'

export async function sendSms(to, body) {
  if (!to) return { skipped: 'no_to' }
  const key = process.env.SIMPLETEXTING_API_KEY
  if (!key) throw new Error('SIMPLETEXTING_API_KEY missing')

  const contactPhone = toSimpleTextingPhone(to)
  if (!contactPhone) return { skipped: 'bad_phone', to }

  const payload = {
    contactPhone,
    text: body,
    mode: 'AUTO',
  }
  const sendingPhone = process.env.SIMPLETEXTING_PHONE
  if (sendingPhone) payload.accountPhone = toSimpleTextingPhone(sendingPhone)

  const res = await fetch(ST_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`simpletexting ${res.status}: ${txt.slice(0, 300)}`)
  }

  return res.json().catch(() => ({}))
}

// SimpleTexting accepts digits-only (e.g. 18005551234 or 8005551234). Our
// normalizePhone produces E.164 (+18005551234); strip the leading + and any
// non-digits.
function toSimpleTextingPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  return digits
}

// Booking confirmation SMS template.
//   buyer: { name }
//   event: { name, event_date, pickup_time }
//   ticketLinks: [{ name, url }] — one entry per ticket on the order. The buyer
//     gets a /tickets/<code> link to show at pickup. We list riders by name so
//     a buyer with multiple tickets can forward the right link to each friend.
export async function sendBookingConfirmation(to, { buyer, event, ticketLinks = [] }) {
  const dateLabel = formatDate(event.event_date)
  const time = event.pickup_time ? ` at ${formatTime(event.pickup_time)}` : ''

  let body = `Brew Loop: you're on the shuttle ${dateLabel}${time}.`

  if (ticketLinks.length === 1) {
    body += `\n\nShow this to the driver when you board: ${ticketLinks[0].url}`
  } else if (ticketLinks.length > 1) {
    body += `\n\nShow these to the driver when you board (one per rider):`
    for (const t of ticketLinks) {
      const label = t.name ? `${t.name}: ` : ''
      body += `\n${label}${t.url}`
    }
  }

  body += `\n\nLost it? ${appUrl()}/my-tickets`
  return sendSms(to, body)
}

// Per-rider confirmation SMS for riders that aren't the buyer. Sent after
// payment so each friend gets their own ticket link + waiver link without the
// buyer having to forward the message manually. Skipped if the rider already
// signed (no waiver line) or already confirmed (caller dedupes).
//   rider: { firstName, ticketUrl, waiverUrl?, hasSignedWaiver }
//   event: { event_date, pickup_time }
export async function sendRiderConfirmation(to, { rider, event }) {
  const dateLabel = formatDate(event.event_date)
  const time = event.pickup_time ? ` at ${formatTime(event.pickup_time)}` : ''
  const greet = rider.firstName ? `Hi ${rider.firstName}, ` : ''

  let body = `${greet}you're on the Brew Loop ${dateLabel}${time}.`
  body += `\nYour ticket: ${rider.ticketUrl}`
  if (!rider.hasSignedWaiver && rider.waiverUrl) {
    body += `\nSign your waiver (30s): ${rider.waiverUrl}`
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
