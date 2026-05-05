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
    address: '1202 Gum Branch Rd, Jacksonville, NC 28540',
    lat: 34.7794209,
    lng: -77.4162900,
    heroImage: '/brand/bars/angry-ginger.webp',
  },
  {
    slug: 'shirley-vs',
    name: "Shirley V's",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Dive-bar heart with cheap cold beer and regulars who treat the jukebox like scripture.',
    address: '619 New Bridge St, Jacksonville, NC 28540',
    lat: 34.7498633,
    lng: -77.4241820,
    heroImage: null,
  },
  {
    slug: 'archies',
    name: "Archie's",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Craft beer, comfort food, and a back room that turns into a dance floor after 10.',
    address: '1811 Lejeune Blvd, Jacksonville, NC 28546',
    lat: 34.7426855,
    lng: -77.3769174,
    heroImage: null,
  },
  {
    slug: 'guss',
    name: "Gus's",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Neighborhood bar where the Loop riders always find friends who were already there.',
    address: '111 Carver Dr, Jacksonville, NC 28544',
    lat: 34.7208574,
    lng: -77.3213354,
    heroImage: null,
  },
  {
    slug: 'hideaway',
    name: 'Hideaway',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Tucked-away spot with strong pours and just enough room to not feel packed.',
    address: '505 Ramsey Rd, Jacksonville, NC 28546',
    lat: 34.8107971522,
    lng: -77.387112993023,
    heroImage: null,
  },
  {
    slug: 'twin-ravens',
    name: 'Twin Ravens',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Dark, loud, fun. The kind of place you end the night at, then remember in pieces.',
    address: '127 Wilmington Hwy, Jacksonville, NC 28540',
    lat: 34.7515567,
    lng: -77.4509465,
    heroImage: null,
  },
  {
    slug: 'black-rose',
    name: 'Black Rose Tavern',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Gothic-leaning pub with live music and cocktails that punch above their weight.',
    address: '175 Freedom Way #10, Jacksonville, NC 28544',
    lat: 34.7185799,
    lng: -77.3244393,
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
// map to attach lat/lng to a schedule entry. Falls back to a normalized
// match (drops "the ", punctuation, extra whitespace) so a slightly-off
// admin entry like "Angry Ginger" still resolves to "The Angry Ginger".
export function getBarByName(name) {
  if (!name) return null
  const target = String(name).trim().toLowerCase()
  const exact = BARS.find(b => b.name.toLowerCase() === target)
  if (exact) return exact
  const norm = normalizeBarName(target)
  if (!norm) return null
  return BARS.find(b => normalizeBarName(b.name) === norm) || null
}

function normalizeBarName(s) {
  return String(s)
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
}
