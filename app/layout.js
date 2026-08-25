import './globals.css'
import { isLoopSite } from '@/lib/site'
import { SITE_URL } from '@/lib/siteUrl'
import { OG_IMAGES } from '@/lib/socialMeta'


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
    // Brew only. The share card is a photograph of the BREW shuttle with Brew
    // pricing on it, and the Loop is a different service on its own domain for
    // riders largely under 21 — putting a bar-hop card on its links would be
    // worse than having no card at all.
    ...(isLoopSite ? null : { images: OG_IMAGES }),
  },
  twitter: {
    card: 'summary_large_image',
    title: M.socialTitle,
    description: M.socialDescription,
    ...(isLoopSite ? null : { images: OG_IMAGES }),
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
