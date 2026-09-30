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
//   2. The address is geocoded (US Census, free, no key) and checked against
//      its zone's maxMiles and NC 172. Zone 2 runs out to NC 172 in Hubert
//      and on Lejeune (Jacob, 2026-09-29; it used to stop at Piney Green Rd,
//      and base was refused). The Census geocoder misses some addresses, base
//      ones especially; a miss is allowed and flagged on the run sheet rather
//      than losing a sale.

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

// Seats held for friends the organizer listed as "they pay their own" who
// have not paid yet. The organizer's booking must name at least 4 riders, so
// those seats are counted as taken the moment the organizer books; a friend's
// own order (carrying their seat_token) takes over the hold when they pay.
// Counts organizer orders that are paid or still inside the pending window.
export async function reservedUnpaidSeats(supabase, eventId, ticketTypeId, pendingCutoff) {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, created_at, metadata, order_items(ticket_type_id, voided_at)')
    .eq('event_id', eventId)
    .in('status', ['paid', 'pending'])
  const live = (orders || []).filter(o => o.status === 'paid' || o.created_at >= pendingCutoff)
  const used = new Set(live.map(o => o.metadata?.door_pickup?.seat_token).filter(Boolean))
  let held = 0
  for (const o of live) {
    const roster = o.metadata?.door_pickup?.roster
    if (!Array.isArray(roster) || !roster.length) continue
    if (!(o.order_items || []).some(i => i.ticket_type_id === ticketTypeId && !i.voided_at)) continue
    held += roster.filter(r => !used.has(r.token)).length
  }
  return held
}

// The $10 includes a Brew Loop seat that night. Anyone the organizer says is
// riding it gets taken to Angry Ginger and boards with the Ginger crowd, so
// those seats count against Ginger's 13 on that night's Brew Loop. The count
// lives on the organizer's order (metadata.door_pickup.brew_loop, with
// brew_loop_date) and holds while the order is paid or inside the pending
// window, the same as any other seat.
export const BREW_LOOP_STOP = /ginger/i

// { event, tt } for that night's public Brew Loop and its Ginger stop, or null.
export async function findBrewLoopStop(supabase, eventDate) {
  const { data: evs } = await supabase
    .from('events')
    .select('id, name, group_id, is_private, kind, status, ticket_types(id, name, stop_index, capacity, active)')
    .eq('event_date', eventDate)
    .eq('kind', 'brew')
    .eq('is_private', false)
    .not('group_id', 'is', null)
  for (const ev of evs || []) {
    const tt = (ev.ticket_types || []).find(t => t.active !== false && t.stop_index != null && BREW_LOOP_STOP.test(t.name))
    if (tt) return { event: ev, tt }
  }
  return null
}

// Brew Loop seats door pickup groups are holding on this date.
export async function brewLoopHolds(supabase, eventDate, pendingCutoff) {
  const { data: orders } = await supabase
    .from('orders')
    .select('status, created_at, metadata')
    .eq('metadata->door_pickup->>brew_loop_date', eventDate)
    .in('status', ['paid', 'pending'])
  return (orders || [])
    .filter(o => o.status === 'paid' || o.created_at >= pendingCutoff)
    .reduce((n, o) => n + (Number(o.metadata?.door_pickup?.brew_loop) || 0), 0)
}

// Seats taken at one stop of an event: paid + pending order_items (native
// and TT mirrored), the same count checkout uses.
export async function stopSeatsTaken(supabase, eventId, stopIndex, pendingCutoff) {
  const sel = 'id, orders!inner(id, event_id, status, created_at)'
  const [{ count: paid }, { count: pending }] = await Promise.all([
    supabase.from('order_items').select(sel, { count: 'exact', head: true })
      .eq('orders.event_id', eventId).is('voided_at', null).eq('orders.status', 'paid').eq('stop_index', stopIndex),
    supabase.from('order_items').select(sel, { count: 'exact', head: true })
      .eq('orders.event_id', eventId).is('voided_at', null).eq('orders.status', 'pending')
      .gte('orders.created_at', pendingCutoff).eq('stop_index', stopIndex),
  ])
  return (paid || 0) + (pending || 0)
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

// Jacksonville train depot, 402 Court St: where the buses stage and drop.
export const DEPOT = { lat: 34.7482, lon: -77.4318 }

// Zones 1 and 2 are off base and share one shuttle, alternating hours. Zone 3
// is on base with its own shuttle every hour (Jacob, 2026-09-29), so base
// addresses only book Zone 3 times. New River Air Station mails as 28545 (its
// land sits inside the 28540 ZCTA on the map). NC 172 is the limit everywhere.
// Zone 3 is on base: every rider needs a valid military or dependent ID to
// get through the gate. The booker confirms it at checkout; the driver checks.
export const BASE_ZONE = 3
export const BASE_ID_TEXT = 'Every adult riding has a valid military or dependent ID to get on base. Kids ride with their parent or guardian.'

export const ZONES = {
  1: { label: 'West Jacksonville & Downtown', zips: ['28540'], maxMiles: 10 },
  2: { label: 'North & East Jacksonville, out to Hwy 172 in Hubert', zips: ['28546', '28539', '28544'], maxMiles: 13 },
  3: { label: 'On base: Camp Lejeune, Camp Johnson, Tarawa Terrace, Midway Park & New River', zips: ['28542', '28543', '28544', '28545', '28547'], maxMiles: 15 },
}

// NC 172 (Census TIGER), [lon, lat], from Sneads Ferry through Lejeune to
// Hwy 24 in Hubert. Nothing south or east of it: no Courthouse Bay, no
// Onslow Beach, no Swansboro. North of Hwy 24 the limit carries straight up
// from the last point, ~150m east of it for slack.
const NC172 = [
  [-77.5036, 34.5393], [-77.4181, 34.5517], [-77.4055, 34.5572], [-77.4019, 34.5611], [-77.3992, 34.5717],
  [-77.4005, 34.5946], [-77.3973, 34.5975], [-77.3884, 34.5981], [-77.3807, 34.5936], [-77.3717, 34.5932],
  [-77.3507, 34.5847], [-77.3246, 34.58], [-77.3156, 34.5756], [-77.3013, 34.5732], [-77.2964, 34.5745],
  [-77.2828, 34.5922], [-77.2818, 34.5958], [-77.2381, 34.6187], [-77.2322, 34.6297], [-77.231, 34.6347],
  [-77.2303, 34.6562], [-77.2389, 34.6729], [-77.24, 34.6781], [-77.239, 34.6907], [-77.2332, 34.7013],
  [-77.2336, 34.7109],
]
const PAST_172 = [...NC172, [-77.232, 34.713], [-77.232, 35.3], [-76.3, 35.3], [-76.3, 34.2], [-77.5036, 34.2]]

function inside(poly, { lon, lat }) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}


export function zoneOfTicketType(tt) {
  const m = /\bZone\s*(\d)\b/i.exec(tt?.name || '')
  return m && ZONES[m[1]] ? Number(m[1]) : null
}

// The slot's own departure as "HH:MM", read off its name ("7:00 PM · Zone 2").
// A door pickup event's pickup_time is the FIRST slot of the day, so anything
// showing a rider their time must use this instead or every rider reads 4 PM.
export function slotPickupTime(name) {
  if (!/\bZone\s*\d\b/i.test(name || '')) return null
  const m = /\b(\d{1,2}):(\d{2})\s*([AP])M\b/i.exec(name || '')
  if (!m) return null
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'P' ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${m[2]}`
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
  // 28544 is in both Zone 2 and Zone 3: Midway Park base housing mails
  // there, but so do off base subdivisions like Hunters Creek.
  if (zone != null && ZONES[zone]?.zips.includes(z)) return null
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

// null when the point is inside coverage, else a rider facing reason.
export function pointProblem(pt, zone) {
  if (!pt) return null
  const z = ZONES[zone]
  if (!z) return null
  if (inside(PAST_172, pt)) return 'That address is past Hwy 172, outside our pickup area.'
  if (milesBetween(DEPOT, pt) > z.maxMiles) return 'That address is too far out, outside our pickup area.'
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
