// Brew Loop service worker — minimal, on purpose.
//
// Goals:
//   1. Make iOS / Android treat us as installable.
//   2. Cache the bare app shell so a rider can re-open their last ticket
//      even with bad reception at a bar.
//
// Non-goals:
//   - Aggressive offline. The Stripe / Supabase / scanner flows all need
//     the network. We never serve stale API responses.

const SHELL_CACHE = 'brew-loop-shell-v1'
const SHELL_PRELOAD = ['/', '/track', '/tickets']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_PRELOAD).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)

  // Never cache mutating requests, the Supabase API, the Stripe webhook,
  // the check-in API, the GPS ping API, or any cross-origin request.
  if (req.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/r/')) return

  // Stale-while-revalidate for HTML / static-ish routes.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {})
          }
          return res
        }).catch(() => cached)
        return cached || fresh
      })
    )
  }
})
