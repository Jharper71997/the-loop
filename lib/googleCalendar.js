// Google Calendar push — service-account JWT, no SDK dependency.
//
// Setup (one-time, in Google Cloud + Calendar):
//   1. Create a service account in any GCP project. Grab its email.
//   2. Generate a JSON key for it. We need client_email + private_key.
//   3. Create or pick a shared Google Calendar.
//   4. In Calendar settings → Share with specific people → add the
//      service-account email with "Make changes to events" permission.
//   5. Copy the calendar's Calendar ID (looks like
//      something@group.calendar.google.com) into env.
//
// Env vars (Vercel + .env.local):
//   GOOGLE_CALENDAR_ID
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_PRIVATE_KEY                (paste the PEM as one line with \n)
//
// All operations no-op silently when env is missing so dev/local works.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/calendar'

function envConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  )
}

function calendarId() {
  return encodeURIComponent(process.env.GOOGLE_CALENDAR_ID)
}

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function signJwt() {
  const { subtle } = globalThis.crypto
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const claimsB64 = base64UrlEncode(JSON.stringify(claims))
  const signingInput = `${headerB64}.${claimsB64}`

  const pem = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  const pkcs8 = pemToPkcs8(pem)
  const key = await subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  )
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`
}

function pemToPkcs8(pem) {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const bin = Buffer.from(body, 'base64')
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
}

let cachedToken = null
let cachedTokenExpiresAt = 0

async function getAccessToken() {
  const now = Date.now()
  if (cachedToken && now < cachedTokenExpiresAt - 60_000) return cachedToken
  const jwt = await signJwt()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`gcal token exchange failed: ${res.status} ${text}`)
  }
  const json = await res.json()
  cachedToken = json.access_token
  cachedTokenExpiresAt = now + (json.expires_in || 3600) * 1000
  return cachedToken
}

function buildEventPayload(shift) {
  const role = shift.role === 'security' ? 'Security' : 'Driver'
  const summary = `${role}: ${shift.person_name}`
  const description = [
    `Role: ${role}`,
    `Night: ${shift.night === 'fri' ? 'Friday' : 'Saturday'}`,
    shift.notes ? `Notes: ${shift.notes}` : null,
    `(Synced from The Loop)`,
  ].filter(Boolean).join('\n')
  return {
    summary,
    description,
    start: { date: shift.shift_date },
    end:   { date: shift.shift_date },
  }
}

export async function pushShiftToGCal(shift) {
  if (!envConfigured()) return null
  try {
    const token = await getAccessToken()
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildEventPayload(shift)),
      }
    )
    if (!res.ok) {
      console.warn('[gcal] insert failed', res.status, await res.text())
      return null
    }
    const json = await res.json()
    return json.id || null
  } catch (err) {
    console.warn('[gcal] push error', err)
    return null
  }
}

export async function updateShiftInGCal(shift) {
  if (!envConfigured() || !shift.gcal_event_id) {
    return pushShiftToGCal(shift)
  }
  try {
    const token = await getAccessToken()
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events/${shift.gcal_event_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildEventPayload(shift)),
      }
    )
    if (!res.ok) {
      console.warn('[gcal] update failed', res.status, await res.text())
      return null
    }
    return shift.gcal_event_id
  } catch (err) {
    console.warn('[gcal] update error', err)
    return null
  }
}

export async function deleteShiftFromGCal(eventId) {
  if (!envConfigured() || !eventId) return
  try {
    const token = await getAccessToken()
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.warn('[gcal] delete failed', res.status, await res.text())
    }
  } catch (err) {
    console.warn('[gcal] delete error', err)
  }
}

export function gcalConfigured() {
  return envConfigured()
}

export function publicCalendarUrl() {
  if (!process.env.GOOGLE_CALENDAR_ID) return null
  return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID)}`
}
