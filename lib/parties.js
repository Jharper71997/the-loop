// Private parties — "book the whole shuttle for your own night".
//
// A party is an ordinary `events` row carrying two extra columns (migration
// 049): is_private, which keeps it out of every public listing, and
// access_token, which is the only way to reach its booking page. The rest of
// the stack is untouched — the party is bought through the same /api/checkout,
// signs the same waiver, mints the same $0 guest claim links, and lands on the
// same boarding pass as a Friday loop.
//
// Shape of a built party:
//   groups   1 row  — holds the ROUTE (schedule jsonb), which we fill in after
//                     they pay. This is the thing we build for them.
//   events   1 row  — is_private = true, access_token set, status 'on_sale'
//                     (a party must be on_sale to be bookable; is_private is
//                     what stops it being advertised).
//   ticket_types 2 rows — the flat-price organizer seat and a $0 guest seat.
//
// Why two ticket types instead of a per-head price: the organizer pays ONE
// flat number we quoted them, and every guest still needs their own row so
// they get their own claim link and sign their own waiver. Stripe accepts $0
// line items as long as the order total is above zero, which it always is here
// because the organizer's seat carries the whole price.

import { randomBytes } from 'crypto'

// The two fares every party is built with. Names are rider-facing — they show
// up as the pick-list on the booking page and on the boarding pass.
export const ORGANIZER_FARE = 'Whole shuttle (organizer)'
export const GUEST_FARE = 'Guest seat'

// Kept in sync with the DB check constraint in 049.
export const REQUEST_STATUSES = ['new', 'quoted', 'booked', 'lost']

// Token = readable slug + random suffix.
//
// The slug is there for us, not for security: a link we are about to paste
// into a text message is much easier to sanity-check as
// /party/kelseys-bachelorette-4f7a2c91 than as a bare UUID, and the organizer
// sees their own party's name in the URL. The 8 hex chars are the actual
// secret — 4 billion possibilities against a page that is not linked from
// anywhere and returns a flat 404 on a miss.
export function mintPartyToken(name) {
  const slug = String(name || 'party')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'party'
  return `${slug}-${randomBytes(4).toString('hex')}`
}

// A party link is not an internal app URL — it goes straight into a text
// message to somebody about to pay us several hundred dollars, so it has to
// carry the brand domain. It deliberately does NOT read APP_URL: that is still
// set to the old the-loop-eight.vercel.app on Brew prod, and a checkout page on
// a vercel.app address reads as a phishing link to a customer who has never
// heard of Vercel.
//
// Parties are Brew-only (see isPartyPath in lib/roles.js), so the Brew
// marketing origin is always right in production. Previews and local dev fall
// back to their own host so a link minted there is actually openable.
const BASE = (
  process.env.VERCEL_ENV === 'production'
    ? 'https://jvillebrewloop.com'
    : (process.env.APP_URL
       || process.env.NEXT_PUBLIC_APP_URL
       || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'))
).replace(/\/$/, '')

export function partyUrl(token) {
  return `${BASE}/party/${token}`
}

// Loads a party by its secret token. Returns null for anything that isn't a
// live private party, so the page can 404 identically whether the token is
// wrong, the party was cancelled, or someone is guessing.
export async function getPartyByToken(sb, token) {
  if (!token) return null

  const { data: event, error } = await sb
    .from('events')
    .select('id, name, event_date, pickup_time, description, status, capacity, cover_image_url, group_id, kind, is_private, access_token')
    .eq('access_token', token)
    .maybeSingle()

  if (error) {
    console.error('[parties] token lookup failed', error)
    return null
  }
  if (!event || !event.is_private) return null
  if (event.status !== 'on_sale') return null

  let schedule = []
  if (event.group_id) {
    const { data: g } = await sb
      .from('groups')
      .select('schedule')
      .eq('id', event.group_id)
      .maybeSingle()
    schedule = Array.isArray(g?.schedule) ? g.schedule : []
  }

  const { data: fares } = await sb
    .from('ticket_types')
    .select('id, name, price_cents, capacity, stop_index, sort_order')
    .eq('event_id', event.id)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  return { event, schedule, fares: fares || [] }
}

// The flat number we quoted them = the price of the organizer seat. Falls back
// to the highest fare so a party built by hand with differently-named tickets
// still shows a price instead of "$0".
export function partyPriceCents(fares) {
  const list = Array.isArray(fares) ? fares : []
  const organizer = list.find(f => f.name === ORGANIZER_FARE)
  if (organizer) return organizer.price_cents || 0
  return list.reduce((max, f) => Math.max(max, f.price_cents || 0), 0)
}

// A route is only worth showing once it has real stops. A freshly-sold party
// has an empty schedule until we build it, and the page says so rather than
// rendering an empty itinerary.
export function hasRoute(schedule) {
  return Array.isArray(schedule) && schedule.some(s => s?.name)
}

export function fmtMoney(cents) {
  const n = (cents || 0) / 100
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`
}

// "19:30" -> "7:30 PM". Returns '' on anything unparseable so callers can just
// drop it from the line rather than printing "Invalid Date".
export function fmtTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

// Dates are stored as plain 'YYYY-MM-DD'. Parsing that as a Date in UTC and
// formatting it in Eastern lands on the previous day, so anchor it at noon.
export function fmtEventDate(d, opts = { weekday: 'long', month: 'long', day: 'numeric' }) {
  if (!d) return ''
  try {
    return new Date(`${d}T12:00:00-05:00`).toLocaleDateString('en-US', {
      ...opts, timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return String(d) }
}
