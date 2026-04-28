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

// Web Push: shows OS notifications even when the app isn't open.
// Payload shape (from lib/push.js): { title, body, url?, tag? }
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Brew Loop', body: event.data?.text() || '' } }
  const title = data.title || 'Brew Loop'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/my-tickets' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification?.data?.url || '/my-tickets'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        try {
          const u = new URL(c.url)
          if (u.pathname === url || c.url.endsWith(url)) {
            if ('focus' in c) return c.focus()
          }
        } catch {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
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
