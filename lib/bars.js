// Static partner-bar directory used by /bars and /bars/[slug].
//
// NOTE (per memory 2026-04-21): The Brew Loop has 8 partner bars total, but the
// weekend ROUTE rotates — different subsets run Fri vs Sat, and weekend-to-weekend.
// Do NOT use this list to advertise which bars are stops on a specific night.
// The per-event schedule comes from Ticket Tailor / ticket_types.
//
// Content TODO for Jacob: replace placeholder blurbs + addresses with real copy
// and add hero photos under public/bars/<slug>.jpg.

export const BARS = [
  {
    slug: 'angry-ginger',
    name: 'The Angry Ginger',
    neighborhood: 'Riverside',
    blurb: 'Irish pub energy with a deep whiskey list and one of the loudest patios in town.',
    address: null,
    heroImage: null,
  },
  {
    slug: 'shirley-vs',
    name: "Shirley V's",
    neighborhood: 'San Marco',
    blurb: 'Dive-bar heart with cheap cold beer and regulars who treat the jukebox like scripture.',
    address: null,
    heroImage: null,
  },
  {
    slug: 'archies',
    name: "Archie's",
    neighborhood: 'Avondale',
    blurb: 'Craft beer, comfort food, and a back room that turns into a dance floor after 10.',
    address: null,
    heroImage: null,
  },
  {
    slug: 'guss',
    name: "Gus's",
    neighborhood: 'TBD',
    blurb: 'Neighborhood bar where the Loop riders always find friends who were already there.',
    address: null,
    heroImage: null,
  },
  {
    slug: 'hideaway',
    name: 'Hideaway',
    neighborhood: 'TBD',
    blurb: 'Tucked-away spot with strong pours and just enough room to not feel packed.',
    address: null,
    heroImage: null,
  },
  {
    slug: 'twin-ravens',
    name: 'Twin Ravens',
    neighborhood: 'TBD',
    blurb: 'Dark, loud, fun. The kind of place you end the night at, then remember in pieces.',
    address: null,
    heroImage: null,
  },
  {
    slug: 'black-rose',
    name: 'Black Rose Tavern',
    neighborhood: 'TBD',
    blurb: 'Gothic-leaning pub with live music and cocktails that punch above their weight.',
    address: null,
    heroImage: null,
  },
  {
    slug: 'partner-8',
    name: 'Partner Bar (TBD)',
    neighborhood: 'TBD',
    blurb: 'The 8th partner — details coming soon.',
    address: null,
    heroImage: null,
  },
]

export function getBar(slug) {
  return BARS.find(b => b.slug === slug) || null
}
