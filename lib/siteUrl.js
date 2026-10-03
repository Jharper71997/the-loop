// The public origin this deployment answers on.
//
// Lifted out of app/layout.js so the structured-data block can build absolute
// URLs from the same resolution the metadata uses — two copies of this would
// drift, and the whole point of the defensive parsing is that it is the one
// place a malformed APP_URL is survived rather than crashing every route.

import { isLoopSite } from './site'

// Resolve the public origin defensively — if someone sets APP_URL on Vercel
// to a value missing the protocol (e.g. "jvillebrewloop.com"), `new URL(...)`
// here throws at module load and every route in the app 500s. Fall back
// rather than crashing the world.
//
// BREW IS PINNED to https://jvillebrewloop.com and does not read APP_URL at all.
// Everything that imports this is SEO: metadataBase (so every canonical tag and
// og:url), the JSON-LD @ids, robots.txt and sitemap.xml. Brew prod still has
// APP_URL=https://the-loop-eight.vercel.app, and because this used to prefer
// APP_URL, every page on jvillebrewloop.com told Google its canonical copy
// lived on the vercel.app host (verified live 2026-10-02: /bars carried
// <link rel="canonical" href="https://the-loop-eight.vercel.app/bars">). There
// is exactly one public Brew domain, so there is nothing to resolve. Links the
// APP sends people (Stripe returns, texted links) still go through appUrl() in
// lib/stripe.js and are untouched by this.
export const BREW_ORIGIN = 'https://jvillebrewloop.com'

function resolveSiteUrl() {
  if (!isLoopSite) return BREW_ORIGIN

  // The standalone Loop site is a different domain, so it must never fall back
  // to the Brew marketing origin. VERCEL_URL is injected on every deploy, which
  // keeps previews honest until APP_URL is set on the project.
  const fallback = isLoopSite
    ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    : 'https://jvillebrewloop.com'
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || fallback
  const trimmed = raw.replace(/\/$/, '')
  try {
    return new URL(trimmed).origin
  } catch {
    const guess = `https://${trimmed.replace(/^https?:\/\//, '')}`
    try {
      return new URL(guess).origin
    } catch {
      return 'https://jvillebrewloop.com'
    }
  }
}

const SITE_URL = resolveSiteUrl()

export { resolveSiteUrl, SITE_URL }
