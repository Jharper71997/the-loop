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
// Private parties are deliberately absent. Jacob, 2026-08-27: nobody browsing
// the site should be able to find them — a private night is sold by a link we
// hand out, not advertised. The booking page lives at /party/<token> and is
// unlinked, unlisted, noindexed and robots-disallowed.
// Loop Pass (2026-09-25): the pass went live 9/21 but /pass was only linked
// from a "Cancel Loop Pass" footer link, so nobody could find it to buy one.
export const NAV_LINKS = [
  { href: '/about', label: 'How It Works' },
  { href: '/bars', label: 'Partner Bars' },
  { href: '/pass', label: 'Loop Pass' },
  { href: '/merch', label: 'Merch' },
  { href: '/sponsors', label: 'Sponsors' },
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
