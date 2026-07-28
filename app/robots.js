const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://jvillebrewloop.com').replace(/\/$/, '')

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep staff consoles, private rider surfaces, and API routes out of
        // the index.
        disallow: [
          '/admin', '/leadership', '/surf', '/loop', '/driver', '/security',
          '/api/', '/cart', '/my-tickets', '/tickets/', '/waiver/', '/c/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
