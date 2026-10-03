import {
  businessNode, serviceNode, faqNode, loopEventNode, graph, jsonLdHtml,
} from '@/lib/jsonLd'
import { SITE_URL } from '@/lib/siteUrl'

// Structured data for the Brew Loop, rendered on the landing page.
//
// The job of `sameAs` (inside businessNode) is to tell Google that
// jvillebrewloop.com, the Instagram account and the Facebook page are ONE
// business rather than three unrelated results. Without it a search for
// "jville brew loop" can rank the Facebook page above the site that actually
// sells the seat.
//
// The business, the shuttle Service, the visible FAQ and the next public loop
// nights all come from lib/jsonLd.js, which documents what is deliberately
// NOT claimed (ratings, hours, a street address, anything about drinks).
//
// `faq` must be the questions this page actually shows; `loops` are the
// public on-sale nights the hero already reads (private parties are filtered
// out upstream in getUpcomingLoops).

export default function BrewJsonLd({ faq = [], loops = [] }) {
  const data = graph([
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Jville Brew Loop', publisher: { '@id': `${SITE_URL}/#business` } },
    businessNode(),
    serviceNode(),
    faq.length ? faqNode(faq) : null,
    ...loops.map(loopEventNode),
  ])

  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />
}
