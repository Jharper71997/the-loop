import { SITE_URL } from '@/lib/siteUrl'
import { OG_IMAGE } from '@/lib/socialMeta'
import { SOCIALS, CONTACT } from './nav'

// Structured data for the Brew Loop, rendered once on the landing page.
//
// The job of `sameAs` is to tell Google that jvillebrewloop.com, the Instagram
// account and the Facebook page are ONE business rather than three unrelated
// results. Without it a search for "jville brew loop" can rank the Facebook
// page above the site that actually sells the seat, and the knowledge panel
// has no social links in it at all.
//
// The URLs come from ./nav SOCIALS — the same constant the footer and the
// landing page's follow row link to. One list, so what we tell Google is ours
// and what a rider can click can never disagree.
//
// NOTHING IN HERE IS INVENTED. Structured data that overstates gets a manual
// action, and more to the point it would be a lie in machine-readable form:
// there is no aggregateRating (we have no review corpus to point at), no
// openingHours (the route rotates and Friday can differ from Saturday), and no
// street address (the Loop publishes a city, not a depot people should drive
// to). Everything present is a fact already published elsewhere on the site.

export default function BrewJsonLd() {
  const abs = path => new URL(path, SITE_URL).toString()

  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#business`,
    name: 'Jville Brew Loop',
    legalName: 'Jville Brew Loop LLC',
    description:
      'Jacksonville’s weekend bar-hop shuttle. One flat-rate seat loops the partner bars every Friday and Saturday night and brings you back to where you started, so nobody in the group has to drive.',
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
    areaServed: {
      '@type': 'City',
      name: 'Jacksonville',
      address: { '@type': 'PostalAddress', addressRegion: 'NC', addressCountry: 'US' },
    },
    sameAs: [SOCIALS.instagram, SOCIALS.facebook],
  }

  return (
    <script
      type="application/ld+json"
      // Serialised rather than templated so a quote or an apostrophe in the
      // copy can't break out of the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
