// Door pickup: the shuttle collects a group from their own address and drops
// them at an event (first run: Jacksonville Oktoberfest, Riverwalk Crossing
// Park, Oct 2-3 2026, buses staged at the downtown train depot). One way only.
// It is NOT a bar loop, so there is no route, no Loop Pass, no Ticket Tailor
// mirror, and no add-ons.
//
// How an event becomes a door pickup event, with no schema change: every
// active ticket type is a departure slot whose name carries its zone, e.g.
// "2:00 PM · Zone 2". Each slot is locked to ONE zone so a single run stays in
// one part of town (the bus does one run an hour).
//
// Coverage is checked two ways, server side:
//   1. ZIP must belong to the slot's zone (instant, always works).
//   2. The address is geocoded (US Census, free, no key). It must be within
//      10 miles of the depot and not east of Piney Green Rd (Stephen: "I don't
//      want to go past that"). The Census geocoder misses some addresses; a
//      miss is allowed and flagged on the run sheet rather than losing a sale.

// Everyone pays their own seat. The organizer books first (their seat, plus
// anyone they choose to cover) and gets a join link; each friend opens it and
// pays for themselves, riding the same slot from the same address. The 4 rider
// minimum is a group target, flagged on the run sheet, not a checkout wall.
export const DOOR_PICKUP_MIN_RIDERS = 4
export const DOOR_PICKUP_MAX_RIDERS = 13

export function mintJoinCode() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, b => abc[b % abc.length]).join('')
}

export function joinUrl(eventId, code) {
  return `https://jvillebrewloop.com/book/${eventId}?join=${code}`
}

// The paid organizer order a join code belongs to, or null.
export async function findParty(supabase, eventId, code) {
  if (!code || !/^[a-z0-9]{6,20}$/.test(code)) return null
  const { data } = await supabase
    .from('orders')
    .select('id, status, buyer_name, metadata, order_items(ticket_type_id, voided_at)')
    .eq('event_id', eventId)
    .eq('metadata->door_pickup->>join_code', code)
    .maybeSingle()
  if (!data || data.status !== 'paid') return null
  const slotId = (data.order_items || []).find(i => !i.voided_at)?.ticket_type_id
  return slotId ? { ...data, slotId } : null
}
export const RADIUS_MILES = 10

// Jacksonville train depot, 402 Court St: where the buses stage and drop.
export const DEPOT = { lat: 34.7482, lon: -77.4318 }

export const ZONES = {
  1: { label: 'West Jacksonville & Downtown', zips: ['28540'] },
  2: { label: 'North & East Jacksonville, up to Piney Green Rd', zips: ['28546'] },
}

// Camp Lejeune, including Tarawa Terrace (28543) and Midway Park (28544)
// housing: the driver cannot get on base.
export const BASE_ZIPS = ['28542', '28543', '28544', '28547']

// Piney Green Rd, north (100 block, at Western Blvd) to south (1300 block),
// from Census geocodes of its own addresses. East of this line is out.
const PINEY_GREEN_RD = [
  [34.7871, -77.3787], [34.7846, -77.3766], [34.7809, -77.3735], [34.7774, -77.3690],
  [34.7738, -77.3609], [34.7699, -77.3533], [34.7659, -77.3447], [34.7608, -77.3403],
]
// About 150m of slack so the far side of Piney Green Rd itself still counts.
const PINEY_GREEN_SLACK = 0.0015

export function zoneOfTicketType(tt) {
  const m = /\bZone\s*(\d)\b/i.exec(tt?.name || '')
  return m && ZONES[m[1]] ? Number(m[1]) : null
}

// Door pickup when the event is a public Brew event with no bar route and
// every active ticket type names a zone.
export function isDoorPickupEvent(event, ticketTypes) {
  if (!event || event.is_private || event.group_id) return false
  if ((event.kind || 'brew') !== 'brew') return false
  const active = (ticketTypes || []).filter(t => t.active !== false)
  return active.length > 0 && active.every(t => zoneOfTicketType(t) != null)
}

export function normalizeZip(raw) {
  const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(String(raw || ''))
  return m ? m[1] : null
}

// null when the ZIP is fine for this zone, else a rider facing reason.
export function zipProblem(zip, zone) {
  const z = normalizeZip(zip)
  if (!z) return 'Enter a 5 digit ZIP code.'
  if (BASE_ZIPS.includes(z)) return 'We can’t pick up on base. Please use an off base address.'
  const owner = Object.entries(ZONES).find(([, v]) => v.zips.includes(z))
  if (!owner) return 'That address is outside our pickup area.'
  if (zone != null && Number(owner[0]) !== zone) {
    return `That ZIP is in Zone ${owner[0]}, ${owner[1].label}. Pick a Zone ${owner[0]} time.`
  }
  return null
}

export function milesBetween(a, b) {
  const R = 3958.8
  const rad = d => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pineyGreenLonAt(lat) {
  const pts = PINEY_GREEN_RD
  if (lat >= pts[0][0]) return pts[0][1]
  if (lat <= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 0; i < pts.length - 1; i++) {
    const [la1, lo1] = pts[i]
    const [la2, lo2] = pts[i + 1]
    if (lat <= la1 && lat >= la2) return lo1 + ((lat - la1) / (la2 - la1)) * (lo2 - lo1)
  }
  return pts[pts.length - 1][1]
}

// null when the point is inside coverage, else a rider facing reason.
export function pointProblem(pt) {
  if (!pt) return null
  if (milesBetween(DEPOT, pt) > RADIUS_MILES) return 'That address is more than 10 miles out, outside our pickup area.'
  if (pt.lon > pineyGreenLonAt(pt.lat) + PINEY_GREEN_SLACK) return 'That address is past Piney Green Rd, outside our pickup area.'
  return null
}

// { lat, lon } or null. Never throws; a slow or failed lookup returns null.
export async function geocodeAddress({ street, city, zip }) {
  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
    url.searchParams.set('address', `${street}, ${city}, NC ${zip}`)
    url.searchParams.set('benchmark', 'Public_AR_Current')
    url.searchParams.set('format', 'json')
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const m = (await res.json())?.result?.addressMatches?.[0]
    if (!m?.coordinates) return null
    return { lat: m.coordinates.y, lon: m.coordinates.x, matched: m.matchedAddress || null }
  } catch {
    return null
  }
}
