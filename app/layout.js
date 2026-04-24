import './globals.css'

const SITE_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://jvillebrewloop.com').replace(/\/$/, '')

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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
