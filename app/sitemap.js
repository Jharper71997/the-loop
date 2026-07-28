import { BARS } from '@/lib/bars'

// Public sitemap. Base URL mirrors app/layout.js metadataBase resolution so it
// tracks whatever domain the app is served from (falls back to the marketing
// domain once published).
const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://jvillebrewloop.com').replace(/\/$/, '')

export default function sitemap() {
  const marketing = ['', '/events', '/bars', '/merch', '/sponsors', '/about', '/track']
  const otherLoops = ['/surfcity', '/marines']
  const bars = BARS.filter(b => b.address && b.slug !== 'partner-8').map(b => `/bars/${b.slug}`)

  const entries = [...marketing, ...bars, ...otherLoops]
  return entries.map(path => ({
    url: `${BASE}${path || '/'}`,
    changeFrequency: path === '' || path === '/events' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/events' ? 0.9 : 0.7,
  }))
}
