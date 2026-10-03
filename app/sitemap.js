import { PUBLIC_PARTNER_BARS } from '@/lib/bars'
import { LANDING_PAGES } from '@/lib/seoPages'
import { isLoopSite } from '@/lib/site'
import { SITE_URL } from '@/lib/siteUrl'

// Public sitemap. Base URL mirrors app/layout.js metadataBase resolution so it
// tracks whatever domain the app is served from (falls back to the marketing
// domain once published).
// SITE_URL, not APP_URL: Brew prod's APP_URL is still the vercel.app host, which
// made the live robots.txt and sitemap advertise the wrong domain. See lib/siteUrl.js.
const BASE = SITE_URL

export default function sitemap() {
  // The standalone Loop site serves only its own pages at the root, and has no
  // bar directory, merch or sponsor pages to advertise.
  const entries = isLoopSite
    ? ['', '/events', '/track']
    : (() => {
        // Private parties are absent on purpose — there is no public page for
        // them at all. A party is reachable only at /party/<token>, which is
        // handed out one link at a time and disallowed in robots.js.
        const marketing = ['', '/events', '/bars', '/merch', '/sponsors', '/about', '/contact', '/track', '/privacy', '/terms', '/refunds', '/cookies']
        const otherLoops = ['/surfcity', '/marines']
        const bars = PUBLIC_PARTNER_BARS.map(b => `/bars/${b.slug}`)
        // Search-landing pages (lib/seoPages.js) and their hub.
        const landing = ['/jacksonville-nc', ...LANDING_PAGES.map(p => `/jacksonville-nc/${p.slug}`)]
        return [...marketing, '/pass', ...landing, ...bars, ...otherLoops]
      })()

  return entries.map(path => ({
    url: `${BASE}${path || '/'}`,
    changeFrequency: path === '' || path === '/events' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/events' ? 0.9 : 0.7,
  }))
}
