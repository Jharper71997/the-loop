// Door pickup: the shuttle collects a group from their own address and drops
// them at an event (first run: Jacksonville Oktoberfest, Riverwalk Crossing
// Park, Oct 2-3 2026). One way only. It is NOT a bar loop, so there is no
// route, no Loop Pass, no Ticket Tailor mirror, and no add-ons.
//
// How an event becomes a door pickup event, with no schema change: every
// active ticket type is a departure slot whose name carries its zone, e.g.
// "2:00 PM · Zone 2". Each slot is locked to ONE zone so a single run stays in
// one part of town (the bus does one run an hour). The zone is by ZIP, checked
// server side against the address the buyer types.

export const DOOR_PICKUP_MIN_RIDERS = 4
export const DOOR_PICKUP_MAX_RIDERS = 13

// Roughly 10 miles of Riverwalk Crossing, plus Hubert (about 12, kept on
// purpose). Camp Lejeune (28547) is excluded: the driver cannot get on base.
export const ZONES = {
  1: { label: 'West Jacksonville & Downtown', zips: ['28540'] },
  2: { label: 'North & East Jacksonville (Northwoods, Piney Green, Gum Branch)', zips: ['28546'] },
  3: { label: 'Tarawa Terrace & Midway Park', zips: ['28543', '28544'] },
  4: { label: 'Hubert', zips: ['28539'] },
}

export const BASE_ZIPS = ['28542', '28547']

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
