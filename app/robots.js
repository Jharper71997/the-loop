import { isLoopSite } from '@/lib/site'
import { SITE_URL } from '@/lib/siteUrl'

// SITE_URL, not APP_URL: Brew prod's APP_URL is still the vercel.app host, which
// made the live robots.txt and sitemap advertise the wrong domain. See lib/siteUrl.js.
const BASE = SITE_URL

// Keep staff consoles, private rider surfaces, and API routes out of the index.
// The console sits at /loop on the combined host and /admin on the standalone
// Loop site, so both spellings are listed rather than branching.
const DISALLOW = [
  '/admin', '/leadership', '/surf', '/loop', '/driver', '/security',
  '/api/', '/cart', '/my-tickets', '/tickets/', '/waiver/', '/c/',
  // A booked private party. /parties (the public pitch) stays indexed; the
  // token pages under it are handed out one at a time and must not be crawled.
  '/party/',
]

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The Loop additionally hides the verify form: it is a step in the
        // buying flow, not a landing page, and indexing it would surface a
        // military-ID prompt with no context.
        disallow: isLoopSite ? [...DISALLOW, '/verify'] : DISALLOW,
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
