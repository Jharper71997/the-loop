import { isLoopSite } from '@/lib/site'

const BASE = (
  process.env.APP_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://jvillebrewloop.com')
).replace(/\/$/, '')

// Keep staff consoles, private rider surfaces, and API routes out of the index.
// The console sits at /loop on the combined host and /admin on the standalone
// Loop site, so both spellings are listed rather than branching.
const DISALLOW = [
  '/admin', '/leadership', '/surf', '/loop', '/driver', '/security',
  '/api/', '/cart', '/my-tickets', '/tickets/', '/waiver/', '/c/',
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
