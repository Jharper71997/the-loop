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
    slug: 'unhinged',
    name: 'Unhinged Bar and Grill',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Bar and grill on Onslow Drive, newest stop on the Loop.',
    address: '2532 Onslow Dr, Jacksonville, NC 28540',
    lat: 34.7639074,
    lng: -77.4184690,
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

// Surf City Loop partner bars (Topsail Island NC) — a SEPARATE business from
// Jville Brew Loop. Kept out of the Brew `BARS` array so a Surf bar can never
// surface on a Brew page or grab a Brew pin. lat/lng are null until Jacob
// provides Topsail coords; Surf schedule stops carry inline coords at build
// time, so the live map works without these (these power /surfcity/bars pages
// and the route-builder picker). 5 confirmed; more pending.
export const SURF_BARS = [
  {
    slug: 'velvet',
    name: 'Velvet',
    neighborhood: 'Surf City, NC',
    blurb: 'Partner stop on the Surf City Loop.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'voodoo',
    name: 'Voodoo',
    neighborhood: 'Surf City, NC',
    blurb: 'Partner stop on the Surf City Loop.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'craft-house',
    name: 'Craft House',
    neighborhood: 'Surf City, NC',
    blurb: 'Partner stop on the Surf City Loop.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'tortugas',
    name: 'Tortugas',
    neighborhood: 'Surf City, NC',
    blurb: 'Partner stop on the Surf City Loop.',
    address: null,
    lat: null,
    lng: null,
    heroImage: null,
  },
  {
    slug: 'backyards',
    name: 'Backyards',
    neighborhood: 'Surf City, NC',
    blurb: 'Partner stop on the Surf City Loop.',
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

// Surf City picker list (route builder).
export const SURF_BAR_NAMES = SURF_BARS.map(b => b.name)

export function getBar(slug) {
  return BARS.find(b => b.slug === slug) || null
}

export function getSurfBar(slug) {
  return SURF_BARS.find(b => b.slug === slug) || null
}

// Look up a bar by display name (case-insensitive) within a given directory.
// Used by the live track map to attach lat/lng to a schedule entry. Falls back
// through three progressively-fuzzier matches so admin schedule typos don't
// drop pins:
//   1. Exact lowercase
//   2. Normalized exact (drops "the ", punctuation, whitespace)
//   3. Normalized substring either direction — handles "Unhinged" vs
//      "Unhinged Bar and Grill" or "Archies Pub" vs "Archie's". Min 4 chars
//      on both sides to avoid spurious "Bar" → every bar matches.
function matchBarByName(list, name) {
  if (!name) return null
  const target = String(name).trim().toLowerCase()
  const exact = list.find(b => b.name.toLowerCase() === target)
  if (exact) return exact

  const norm = normalizeBarName(target)
  if (!norm) return null
  const normExact = list.find(b => normalizeBarName(b.name) === norm)
  if (normExact) return normExact

  if (norm.length < 4) return null
  // Prefer the longest matching candidate so "shirley" beats "s" if both
  // somehow qualify — keeps the most specific bar.
  let best = null
  let bestLen = 0
  for (const b of list) {
    const bn = normalizeBarName(b.name)
    if (bn.length < 4) continue
    if (bn.includes(norm) || norm.includes(bn)) {
      const matchLen = Math.min(bn.length, norm.length)
      if (matchLen > bestLen) { best = b; bestLen = matchLen }
    }
  }
  return best
}

export function getBarByName(name) {
  return matchBarByName(BARS, name)
}

export function getSurfBarByName(name) {
  return matchBarByName(SURF_BARS, name)
}

function normalizeBarName(s) {
  return String(s)
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
}
