import './globals.css'
import { isLoopSite } from '@/lib/site'

// Resolve the public origin defensively — if someone sets APP_URL on Vercel
// to a value missing the protocol (e.g. "jvillebrewloop.com"), `new URL(...)`
// here throws at module load and every route in the app 500s. Fall back
// rather than crashing the world.
function resolveSiteUrl() {
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

// The root layout wraps every business, so its defaults have to match whichever
// site this deployment is. On the Loop domain a shared Brew title would leak
// bar-shuttle branding onto a service whose riders are largely under 21.
const BREW_META = {
  title: {
    default: 'Jville Brew Loop — Jacksonville\'s weekend bar-hop shuttle',
    template: '%s · Jville Brew Loop',
  },
  description: 'Hop between partner bars every Friday and Saturday night in Jacksonville. $20 per seat. Book a ride, track the shuttle live, ride safe.',
  siteName: 'Jville Brew Loop',
  socialTitle: 'Jville Brew Loop — weekend bar-hop shuttle',
  socialDescription: 'Jacksonville\'s Friday and Saturday night shuttle between partner bars. $20 per seat, tracked live, ride safe.',
}

const LOOP_META = {
  title: {
    default: 'The Loop — a shuttle around Jacksonville for Marines',
    template: '%s · The Loop',
  },
  description: 'No car, no problem. The Loop runs a constant route from base into Jacksonville and back all day. Grab a ride, sign your waiver, show your QR when you board.',
  siteName: 'The Loop',
  socialTitle: 'The Loop — get off base and go do something',
  socialDescription: 'A constant loop from base into town and back, all day on the weekend. Cheaper than an Uber and it runs whether or not your buddy has a car.',
}

const M = isLoopSite ? LOOP_META : BREW_META

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: M.title,
  description: M.description,
  openGraph: {
    type: 'website',
    siteName: M.siteName,
    title: M.socialTitle,
    description: M.socialDescription,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: M.socialTitle,
    description: M.socialDescription,
  },
  robots: { index: true, follow: true },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
