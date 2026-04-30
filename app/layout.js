import './globals.css'

// Resolve the public origin defensively — if someone sets APP_URL on Vercel
// to a value missing the protocol (e.g. "jvillebrewloop.com"), `new URL(...)`
// here throws at module load and every route in the app 500s. Fall back
// rather than crashing the world.
function resolveSiteUrl() {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://jvillebrewloop.com'
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

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Jville Brew Loop — Jacksonville\'s weekend bar-hop shuttle',
    template: '%s · Jville Brew Loop',
  },
  description: 'Hop between partner bars every Friday and Saturday night in Jacksonville. $20 per seat. Book a ride, track the shuttle live, ride safe.',
  openGraph: {
    type: 'website',
    siteName: 'Jville Brew Loop',
    title: 'Jville Brew Loop — weekend bar-hop shuttle',
    description: 'Jacksonville\'s Friday and Saturday night shuttle between partner bars. $20 per seat, tracked live, ride safe.',
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jville Brew Loop — weekend bar-hop shuttle',
    description: 'Jacksonville\'s Friday and Saturday night shuttle between partner bars. $20 per seat, tracked live, ride safe.',
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
