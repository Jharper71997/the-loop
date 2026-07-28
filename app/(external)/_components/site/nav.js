// Single source of truth for the Brew Loop marketing-website chrome: which
// paths get the website header/footer (vs. the app tab bar), the nav links, the
// primary CTA, and the real social / contact info. Imported by RiderChrome,
// SiteHeader and SiteFooter. Plain module (no hooks) → server + client safe.
//
// NOTE: everything here is Brew-only. Surf (/surfcity) and Marines (/marines)
// keep the app chrome (TopBar + TabBar); RiderChrome never calls isMarketingPath
// for them.

// Top-nav links (Buy Tickets is the CTA, kept separate below).
export const NAV_LINKS = [
  { href: '/track', label: 'Find My Bus' },
  { href: '/bars', label: 'Partner Bars' },
  { href: '/merch', label: 'Merch' },
  { href: '/sponsors', label: 'Sponsors' },
  { href: '/about', label: 'About' },
]

export const PRIMARY_CTA = { href: '/events', label: 'Buy Tickets' }

// Real Brew Loop socials (pulled from the live jvillebrewloop.com footer).
export const SOCIALS = {
  instagram: 'https://www.instagram.com/jville_brew_loop',
  facebook: 'https://www.facebook.com/profile.php?id=61584620131781',
}

export const CONTACT = {
  generalEmail: 'hello@jvillebrewloop.com',
  partnerEmail: 'richard@jvillebrewloop.com',
  ticketsEmail: 'tickets@jvillebrewloop.com',
  phone: '+16362661801',
  phoneDisplay: '(636) 266-1801',
}

// Marketing pages get the website chrome (top nav + footer, no bottom tab bar).
// Everything else (booking / track / tickets / waiver / pass / leaderboard)
// keeps the app chrome. `rel` is the pathname with the business basePath
// stripped — for Brew that's just the pathname.
const MARKETING_EXACT = new Set(['/', '/cart', '/sponsors', '/about', '/merch', '/bars'])
const MARKETING_PREFIXES = ['/merch/', '/bars/']

export function isMarketingPath(rel) {
  const p = (rel || '/').split('?')[0].split('#')[0]
  if (MARKETING_EXACT.has(p)) return true
  return MARKETING_PREFIXES.some(pre => p.startsWith(pre))
}
