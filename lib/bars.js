// Static partner-bar directory used by /bars, /bars/[slug], the admin Loop
// scheduler, and the live tracking map.
//
// NOTE: the weekend ROUTE rotates — different subsets run Fri vs Sat, and
// weekend-to-weekend. Do NOT use this list to advertise which bars are stops
// on a specific night. The per-event schedule comes from groups.schedule.
//
// For any public "N partner bars" claim, use PARTNER_BAR_COUNT below, never a
// hardcoded number. The `partner-8` placeholder that used to sit at the end of
// this array was filled by Brassa Tacos & Taps on 2026-08-19, so all eight rows
// are real partners now. If a future slot opens as a placeholder again, give it
// a null `address` — PUBLIC_PARTNER_BARS filters those out of the count.
//
// lat/lng are needed for the live track map (Step 11). Update as Jacob
// provides real coordinates; placeholders are nullable so missing data
// hides the marker rather than dropping a wrong pin.
//
// BLURBS: describe the VENUE, never the drinks. Brew Loop is a shuttle, not an
// alcohol seller, and can't legally market alcohol — so no "cheap cold beer",
// "strong pours", "deep whiskey list", or drink specials, even when they're the
// thing the bar is known for. (Archies Pub's Nickel Night is real; it still
// can't go here.) These blurbs render publicly on /bars, /bars/[slug] and the
// homepage.
//
// PHOTOS: `heroImage` is the venue's SIGN or LOGO — it renders contained on a
// dark plate on the tile grid and the detail hero, never cropped. The optional
// `photos` array is different: real scenery/food shots that render as a gallery
// band on /bars/[slug] only. Same no-alcohol rule as the blurbs — Brassa has
// good cocktail shots and they stay out; the food ones are the ones we can use.
//
// NAMES: these are the venues' real names, matched to their signage. They used
// to be shortened here ("Archie's", "Hideaway") while the ticket types and the
// weekend schedule in Supabase carried the full ones — so the same bar read as
// two different places depending on which page you were on. The DB was right;
// this file was wrong. If these ever disagree again, the schedule wins, because
// Ticket Tailor sync matches on groups.schedule[].name and renaming those
// breaks the hold reconciliation (see lib/ticketTailorSync.js).

export const BARS = [
  {
    slug: 'angry-ginger',
    name: 'Angry Ginger',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Irish pub energy and one of the loudest patios in town.',
    address: '1202 Gum Branch Rd, Jacksonville, NC 28540',
    lat: 34.7794209,
    lng: -77.4162900,
    heroImage: '/brand/bars/angry-ginger.webp',
  },
  {
    slug: 'shirley-vs',
    name: "Shirley V's",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Dive-bar heart, with regulars who treat the jukebox like scripture.',
    address: '619 New Bridge St, Jacksonville, NC 28540',
    lat: 34.7498633,
    lng: -77.4241820,
    heroImage: '/brand/photos/sign-shirley-vs.jpg',
  },
  {
    slug: 'archies',
    name: 'Archies Pub',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Irish-leaning pub on Lejeune with comfort food, and Friday is its big night.',
    address: '1811 Lejeune Blvd, Jacksonville, NC 28546',
    lat: 34.7426855,
    lng: -77.3769174,
    heroImage: '/brand/photos/sign-archies.jpg',
  },
  {
    slug: 'hideaway',
    name: 'Hideaway Lounge',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Tucked-away spot with just enough room to not feel packed.',
    address: '505 Ramsey Rd, Jacksonville, NC 28546',
    lat: 34.8107971522,
    lng: -77.387112993023,
    heroImage: '/brand/photos/sign-hideaway.jpg',
  },
  {
    slug: 'twin-ravens',
    name: 'Twin Ravens Tavern',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Dark, loud, fun. The kind of place you end the night at.',
    address: '127 Wilmington Hwy, Jacksonville, NC 28540',
    lat: 34.7515567,
    lng: -77.4509465,
    heroImage: '/brand/photos/sign-twin-ravens.jpg',
  },
  {
    slug: 'black-rose',
    name: 'Black Rose Tavern',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Gothic-leaning pub with live music most weekends.',
    address: '175 Freedom Way #10, Jacksonville, NC 28544',
    lat: 34.7185799,
    lng: -77.3244393,
    heroImage: '/brand/photos/sign-black-rose.jpg',
  },
  {
    slug: 'unhinged',
    name: 'Unhinged Bar and Grill',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Bar and grill on Onslow Drive, newest stop on the Loop.',
    address: '2532 Onslow Dr, Jacksonville, NC 28540',
    lat: 34.7639074,
    lng: -77.4184690,
    heroImage: '/brand/photos/sign-unhinged.jpg',
  },
  {
    slug: 'brassa',
    name: 'Brassa Tacos & Taps',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Mexican restaurant on Western Boulevard, newest stop on the Loop.',
    address: '4157 Western Blvd Suite 100, Jacksonville, NC 28546',
    lat: 34.7984386,
    lng: -77.4141254,
    heroImage: '/brand/bars/brassa.png',
    photos: [
      { src: '/brand/bars/brassa-food-1.jpg', alt: 'A plated ceviche at Brassa Tacos & Taps' },
      { src: '/brand/bars/brassa-food-2.jpg', alt: 'A crispy shrimp dish at Brassa Tacos & Taps' },
    ],
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

// The Loop (Marines / Camp Lejeune NC) partner stops — a SEPARATE business from
// Brew + Surf. Kept out of the other arrays so a Loop stop can never surface on
// a Brew/Surf page or grab the wrong pin. lat/lng are null until Jacob provides
// real coords; builder-picked stops carry inline coords, so the live map works
// without these (these power /marines/bars pages + the route-builder picker).
// NAMES BELOW ARE PLACEHOLDERS — confirm the real Camp Lejeune stop list.
// Real Camp Lejeune / New River route stops with geocoded coords (from
// scripts/fix-marines-coords.js). PROVISIONAL pending Stephen's final stop list
// and the exact on-base pickup spot — 'new-river-gate' is the base pickup. Slugs
// dragon-brew + good-times are kept as-is (migration 045 seeded them in the bars
// table).
export const MARINES_BARS = [
  {
    slug: 'new-river-gate',
    name: 'New River Gate',
    neighborhood: 'MCAS New River',
    blurb: 'On-base pickup — board The Loop here.',
    address: '187 Curtis Rd, Jacksonville, NC',
    lat: 34.7286409,
    lng: -77.4701155,
    on_base: true,
    heroImage: null,
  },
  {
    slug: 'dragon-brew',
    name: "Dragon's Brew",
    neighborhood: 'Jacksonville, NC',
    blurb: 'Coffee stop on The Loop.',
    address: '3430 Richlands Hwy, Jacksonville, NC',
    lat: 34.7623492,
    lng: -77.4857645,
    heroImage: null,
  },
  {
    slug: 'mario-co',
    name: 'Mario & Co',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Barber stop on The Loop.',
    address: '108 Western Blvd, Jacksonville, NC',
    lat: 34.7458360,
    lng: -77.3792252,
    heroImage: null,
  },
  {
    slug: 'good-times',
    name: 'Good Times',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Tattoo stop on The Loop.',
    address: '1657 Lejeune Blvd, Jacksonville, NC',
    lat: 34.7435232,
    lng: -77.3825875,
    heroImage: null,
  },
  {
    slug: 'angry-ginger',
    name: 'Angry Ginger',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Food stop on The Loop.',
    address: '1202 Gum Branch Rd, Jacksonville, NC',
    lat: 34.7794209,
    lng: -77.4162900,
    heroImage: null,
  },
  {
    slug: 'crush-nutrition',
    name: 'Crush Nutrition',
    neighborhood: 'Jacksonville, NC',
    blurb: 'Nutrition stop on The Loop.',
    address: '571 Yopp Rd, Jacksonville, NC',
    lat: 34.7539334,
    lng: -77.4641163,
    heroImage: null,
  },
  {
    slug: 'cozy-co',
    name: 'Cozy Co',
    neighborhood: 'Downtown Jacksonville, NC',
    blurb: 'Downtown stop on The Loop.',
    address: '408 Mill Ave, Jacksonville, NC',
    lat: 34.7496607,
    lng: -77.4324215,
    heroImage: null,
  },
]

// Plain-name list for picker dropdowns (Loop creation + schedule editor).
// Excludes the TBD placeholder so it doesn't pollute the picker.
export const PARTNER_BAR_NAMES = BARS
  .filter(b => b.slug !== 'partner-8')
  .map(b => b.name)

// The bars the public website advertises: real, named, addressable partners.
// Every "N partner bars" claim on the marketing site MUST come from these two
// exports rather than a typed-in number — the site used to say "8 partner bars"
// above a list that rendered 7, because the 8th row here is the TBD placeholder.
// Add a real bar to BARS and the copy updates itself.
export const PUBLIC_PARTNER_BARS = BARS.filter(b => b.address && b.slug !== 'partner-8')
export const PARTNER_BAR_COUNT = PUBLIC_PARTNER_BARS.length

// Spelled out for prose ("Seven partner bars, one rotating route").
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
export const PARTNER_BAR_COUNT_WORD = NUMBER_WORDS[PARTNER_BAR_COUNT] || String(PARTNER_BAR_COUNT)

// Surf City picker list (route builder).
export const SURF_BAR_NAMES = SURF_BARS.map(b => b.name)

// The Loop (Marines) picker list (route builder); drops the TBD placeholders.
export const MARINES_BAR_NAMES = MARINES_BARS
  .filter(b => !b.slug.startsWith('marines-tbd'))
  .map(b => b.name)

export function getBar(slug) {
  return BARS.find(b => b.slug === slug) || null
}

export function getSurfBar(slug) {
  return SURF_BARS.find(b => b.slug === slug) || null
}

export function getMarinesBar(slug) {
  return MARINES_BARS.find(b => b.slug === slug) || null
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

export function getMarinesBarByName(name) {
  return matchBarByName(MARINES_BARS, name)
}

function normalizeBarName(s) {
  return String(s)
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
}
