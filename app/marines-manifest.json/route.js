import { isLoopSite } from '@/lib/site'

// The Loop's PWA manifest. Served from a route rather than /public because
// start_url and scope depend on which deployment this is: the rider surface
// sits at /marines on the combined Brew host and at the root on the standalone
// Loop site. A wrong scope makes the installed app open to a blank shell.
//
// Copy note: never describe this as a bar or brew shuttle. The Loop carries
// Marines who are largely under 21 and it is deliberately unbranded from Brew.
export const dynamic = 'force-static'

export function GET() {
  const base = isLoopSite ? '/' : '/marines'

  return Response.json({
    name: 'The Loop',
    short_name: 'The Loop',
    description: 'The Loop — a shuttle around Jacksonville for Marines. Grab a ride, sign your waiver, show your QR when you board.',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    categories: ['travel', 'lifestyle'],
  }, {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}
