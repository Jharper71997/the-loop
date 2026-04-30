// Static partner-bar directory used by /bars, /bars/[slug], the admin Loop
// scheduler, and the live tracking map.
//
// NOTE (per memory 2026-04-21): The Brew Loop has 8 partner bars total, but
// the weekend ROUTE rotates — different subsets run Fri vs Sat, and
// weekend-to-weekend. Do NOT use this list to advertise which bars are stops
// on a specific night. The per-event schedule comes from groups.schedule.
//
// lat/lng are needed for the live track map (Step 11). Update as Jacob
// provides real coordinates; placeholders are nullable so missing data
// hides the marker rather than dropping a wrong pin.

export const BARS = [
  {
    slug: 'angry-ginger',
    name: 'The Angry Ginger',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Irish pub energy with a deep whiskey list and one of the loudest patios in town.',
    address: null,
    lat: null,
    lng: null,
    heroImage: '/brand/bars/angry-ginger.webp',
  },
  {
    slug: 'shirley-vs',
    name: "Shirley V's",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Dive-bar heart with cheap cold beer and regulars who treat the jukebox like scripture.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'archies',
    name: "Archie's",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Craft beer, comfort food, and a back room that turns into a dance floor after 10.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'guss',
    name: "Gus's",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Neighborhood bar where the Loop riders always find friends who were already there.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'hideaway',
    name: 'Hideaway',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Tucked-away spot with strong pours and just enough room to not feel packed.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'twin-ravens',
    name: 'Twin Ravens',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Dark, loud, fun. The kind of place you end the night at, then remember in pieces.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'black-rose',
    name: 'Black Rose Tavern',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Gothic-leaning pub with live music and cocktails that punch above their weight.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'partner-8',
    name: 'Partner Bar (TBD)',
    neighborhood: 'Jacksonville, NC',
    blurb: 'The 8th partner — details coming soon.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
]

// Plain-name list for picker dropdowns (Loop creation + schedule editor).
// Excludes the TBD placeholder so it doesn't pollute the picker.
export const PARTNER_BAR_NAMES = BARS
  .filter(b => b.slug !== 'partner-8')
  .map(b => b.name)

export function getBar(slug) {
  return BARS.find(b => b.slug === slug) || null
}

// Look up a bar by display name (case-insensitive). Used by the live track
// map to attach lat/lng to a schedule entry.
export function getBarByName(name) {
  if (!name) return null
  const target = String(name).trim().toLowerCase()
  return BARS.find(b => b.name.toLowerCase() === target) || null
}
