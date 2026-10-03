// Structured data (schema.org JSON-LD) for the Brew Loop website, in ONE place.
//
// Google reads this for rich results, and AI assistants (ChatGPT, Gemini,
// Copilot) lean on it to work out what a business is, where it operates and
// what it costs. Every page that emits JSON-LD builds it from these helpers so
// the business is described identically everywhere and every node points back
// to the same @id.
//
// NOTHING IN HERE IS INVENTED. Structured data that overstates gets a manual
// action, and it would be a lie in machine-readable form. Specifically absent,
// on purpose:
//   - aggregateRating / review: there is no review corpus to point at.
//   - openingHoursSpecification: the route rotates and Friday can differ from
//     Saturday; the published "around 7:30 PM to around 1:30 AM" is an FAQ
//     answer, not hours a door is open.
//   - a street address for the business: the Loop publishes a city, not a
//     depot. Bars carry their own addresses (from lib/bars.js) because those
//     ARE published on the site.
//   - offer availability on events: we do not know sell-out state at render
//     time without another query, and a wrong InStock is worse than none.
//   - anything about drinks. Brew Loop is a shuttle and cannot market alcohol.

import { SITE_URL } from './siteUrl'
import { OG_IMAGE } from './socialMeta'
import { getBar } from './bars'
import { SOCIALS, CONTACT } from '@/app/(external)/_components/site/nav'

export const BUSINESS_ID = `${SITE_URL}/#business`
export const SERVICE_ID = `${SITE_URL}/#shuttle`

export const abs = path => new URL(path, SITE_URL).toString()

const JACKSONVILLE = {
  '@type': 'City',
  name: 'Jacksonville',
  containedInPlace: {
    '@type': 'AdministrativeArea',
    name: 'Onslow County',
    containedInPlace: { '@type': 'State', name: 'North Carolina' },
  },
}

// The business itself. Rendered in full on the homepage; every other page
// references it by @id rather than repeating it.
export function businessNode() {
  return {
    '@type': 'LocalBusiness',
    '@id': BUSINESS_ID,
    name: 'Jville Brew Loop',
    alternateName: ['Brew Loop', 'Jacksonville Brew Loop'],
    legalName: 'Jville Brew Loop LLC',
    description:
      'Jacksonville, NC’s weekend bar-hop shuttle. One flat-rate $20 seat rides a scheduled loop between partner bars every Friday and Saturday night and returns riders to their original pickup, so nobody in the group has to drive between bars.',
    url: SITE_URL,
    logo: abs('/brand/badge-gold.png'),
    image: abs(OG_IMAGE.url),
    email: CONTACT.email,
    telephone: CONTACT.phone,
    priceRange: '$20',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Jacksonville',
      addressRegion: 'NC',
      addressCountry: 'US',
    },
    areaServed: JACKSONVILLE,
    sameAs: [SOCIALS.instagram, SOCIALS.facebook],
    makesOffer: { '@id': SERVICE_ID },
  }
}

// What we sell, as a Service. This is the node that lets an assistant answer
// "is there a bar shuttle in Jacksonville NC and what does it cost".
export function serviceNode() {
  return {
    '@type': 'Service',
    '@id': SERVICE_ID,
    name: 'Jville Brew Loop bar-hop shuttle',
    serviceType: 'Bar-hopping shuttle',
    description:
      'A scheduled shuttle loop between partner bars in Jacksonville, NC on Friday and Saturday nights. One seat covers the whole night; riders must be 21 or older.',
    provider: { '@id': BUSINESS_ID },
    areaServed: JACKSONVILLE,
    audience: { '@type': 'PeopleAudience', suggestedMinAge: 21 },
    offers: {
      '@type': 'Offer',
      price: '20.00',
      priceCurrency: 'USD',
      description: 'One seat, the whole night on the Loop.',
      url: abs('/events'),
    },
  }
}

export function breadcrumbNode(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  }
}

// FAQPage. Only ever pass questions that are VISIBLE on the same page; Google
// requires the markup to match what a reader can see.
export function faqNode(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(it => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  }
}

export function webPageNode({ path, name, description, about }) {
  return {
    '@type': 'WebPage',
    '@id': `${abs(path)}#webpage`,
    url: abs(path),
    name,
    description,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Jville Brew Loop' },
    publisher: { '@id': BUSINESS_ID },
    ...(about ? { about } : null),
  }
}

// A partner bar, as the thing a bar page is ABOUT. Name, address and geo come
// straight from lib/bars.js, which is what the page itself prints.
export function barPlaceNode(bar) {
  const node = { '@type': 'BarOrPub', name: bar.name }
  if (bar.address) {
    // lib/bars.js keeps a one-line address ("1202 Gum Branch Rd, Jacksonville,
    // NC 28540"); split off the street, keep the rest as published.
    const m = bar.address.match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?$/)
    node.address = m
      ? { '@type': 'PostalAddress', streetAddress: m[1], addressLocality: m[2], addressRegion: m[3], ...(m[4] ? { postalCode: m[4] } : null), addressCountry: 'US' }
      : { '@type': 'PostalAddress', streetAddress: bar.address, addressCountry: 'US' }
  }
  if (Number.isFinite(bar.lat) && Number.isFinite(bar.lng)) {
    node.geo = { '@type': 'GeoCoordinates', latitude: bar.lat, longitude: bar.lng }
  }
  return node
}

// ---------------------------------------------------------------- Events ----

// Eastern offset for a calendar date in Jacksonville, NC ("-04:00" in summer,
// "-05:00" in winter). Computed, not assumed, because loops run across the
// November switch.
function easternOffset(ymd) {
  try {
    const probe = new Date(`${ymd}T12:00:00Z`)
    const part = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
      .formatToParts(probe).find(p => p.type === 'timeZoneName')?.value // "GMT-4"
    const h = Number(String(part).replace('GMT', '')) || -5
    const sign = h < 0 ? '-' : '+'
    return `${sign}${String(Math.abs(h)).padStart(2, '0')}:00`
  } catch {
    return null
  }
}

function startDateFor(eventDate, pickupTime) {
  if (!eventDate) return null
  const t = /^\d{1,2}:\d{2}/.test(String(pickupTime || '')) ? String(pickupTime).slice(0, 5).padStart(5, '0') : null
  const off = easternOffset(eventDate)
  // Date-only is valid schema.org and better than a guessed time.
  return t && off ? `${eventDate}T${t}:00${off}` : eventDate
}

// One public loop night (a row from lib/upcomingLoops getUpcomingLoops) as an
// Event. Location is the night's first pickup bar; price is the night's lowest
// active fare, straight from the ticket types.
//
// ONLY bar-loop nights become Events: a night qualifies when its pickups
// resolve to partner bars in lib/bars.js. Other products share the same
// listing (the Oktoberfest door pickup sells zone/time slots, is all ages, and
// is not a bar loop), and describing those as a 21+ night between bars would
// be false. Returns null for them; graph() drops nulls.
export function loopEventNode(loop) {
  const startDate = startDateFor(loop.eventDate, loop.pickupTime)
  if (!startDate) return null
  const barStops = (loop.stops || []).map(s => (s.slug ? getBar(s.slug) : null)).filter(Boolean)
  if (!barStops.length) return null
  const location = barPlaceNode(barStops[0])
  const stopNames = barStops.map(b => b.name)
  const node = {
    '@type': 'Event',
    name: loop.name || 'Jville Brew Loop',
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location,
    image: abs(loop.coverImageUrl || OG_IMAGE.url),
    description: stopNames.length
      ? `A night on the Jville Brew Loop bar-hop shuttle in Jacksonville, NC. Pickup bars: ${stopNames.join(', ')}. 21+.`
      : 'A night on the Jville Brew Loop bar-hop shuttle in Jacksonville, NC. 21+.',
    organizer: { '@type': 'Organization', name: 'Jville Brew Loop', url: SITE_URL },
    typicalAgeRange: '21-',
    url: abs(`/book/${loop.id}`),
  }
  if (Number.isFinite(loop.fromPriceCents)) {
    node.offers = {
      '@type': 'Offer',
      price: (loop.fromPriceCents / 100).toFixed(2),
      priceCurrency: 'USD',
      url: abs(`/book/${loop.id}`),
    }
  }
  return node
}

// ------------------------------------------------------------ Rendering ----

// Wrap nodes in one @graph document. Falsy entries are dropped so callers can
// write `[a, cond && b]`.
export function graph(nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) }
}

// Serialised rather than templated so a quote or an apostrophe in the copy
// can't break out of the <script> tag.
export function jsonLdHtml(data) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') }
}
