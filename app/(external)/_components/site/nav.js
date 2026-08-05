// Single source of truth for the Brew Loop marketing-website chrome: the nav
// links, the primary CTA, and the real social / contact info. Imported by
// SiteHeader, SiteFooter and the contact + sponsors pages. Plain module (no
// hooks) → server + client safe.
//
// NOTE: everything here is Brew-only. Surf (/surfcity) and Marines (/marines)
// keep the app chrome (TopBar + TabBar); RiderChrome branches on business kind
// before any of this is used.

// Top-nav links, ordered for a STRANGER — someone who just landed from Google
// and doesn't know what the Loop is yet.
//
// What changed and why:
//  - "Find My Bus" used to sit in the first slot, but it's useless unless you
//    already hold a ticket. It moved to UTILITY_LINK (small, right-hand side).
//  - "Sponsors" left the main nav entirely. It's a B2B ask in a rider nav; it
//    lives in the footer and at the bottom of the landing page now.
//  - /about is "How It Works" in every single place — nav, footer, <title>.
export const NAV_LINKS = [
  { href: '/about', label: 'How It Works' },
  { href: '/bars', label: 'Partner Bars' },
  { href: '/merch', label: 'Merch' },
]

// ONE name for the one action, everywhere on the site: nav, hero, every card,
// every closing band. It used to be "Buy Tickets" in the nav, "Book a seat" in
// the hero and "Book" on the event cards — three words for the same click.
export const PRIMARY_CTA = { href: '/events', label: 'Book a seat' }

// Small right-hand utility link for people mid-night who already have a seat.
export const UTILITY_LINK = { href: '/track', label: 'Find my bus' }

// Real Brew Loop socials (pulled from the live jvillebrewloop.com footer).
export const SOCIALS = {
  instagram: 'https://www.instagram.com/jville_brew_loop',
  facebook: 'https://www.facebook.com/profile.php?id=61584620131781',
}

// ONE published address and ONE published phone across the whole site — riders,
// bars, and sponsors all reach the same inbox. Matches what jvillebrewloop.com
// has been publishing. Changing it here changes it everywhere (header, footer,
// /contact, /sponsors, /bars).
export const CONTACT = {
  email: 'jacob@jvillebrewloop.com',
  phone: '+12197793677',
  phoneDisplay: '(219) 779-3677',
  city: 'Jacksonville, NC',
}

// The WEBSITE pages, as opposed to the APP pages a rider uses on the night
// (/book, /track, /my-tickets, /tickets, /pass, /waiver).
//
// Both sets share the same header and footer — it's one site. This list exists
// so app-only affordances stay off the website: someone who just landed from
// Google shouldn't be asked to install a home-screen app before they know what
// the Loop even is. Brew paths only; Surf and Marines never match.
const MARKETING_EXACT = new Set(['/', '/about', '/bars', '/merch', '/cart', '/sponsors', '/contact'])
const MARKETING_PREFIXES = ['/merch/', '/bars/']

export function isMarketingPath(pathname) {
  const p = (pathname || '/').split('?')[0].split('#')[0]
  if (MARKETING_EXACT.has(p)) return true
  return MARKETING_PREFIXES.some(pre => p.startsWith(pre))
}
