import PwaShell from './_components/PwaShell'
import RiderChrome from './_components/site/RiderChrome'

export const metadata = {
  title: { default: 'Brew Loop', template: '%s · Brew Loop' },
  description: 'Jville Brew Loop — book a ride, sign your waiver, show your QR when you board.',
  manifest: '/manifest.json',
  themeColor: '#0a0a0b',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Brew Loop',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
}

export default function ExternalLayout({ children }) {
  // RiderChrome switches between the Brew marketing-website chrome (top nav +
  // footer) and the app chrome (TopBar + bottom TabBar) by path + business. The
  // bottom padding that clears the fixed TabBar now lives inside RiderChrome's
  // app branch, so marketing pages don't get a dead gap under the footer.
  return (
    <div
      className="external-shell"
      style={{
        minHeight: '100dvh',
        background: '#0a0a0b',
        color: '#f5f5f7',
        // Guard the rider surface against any horizontal overflow (long headings,
        // wide grids) shifting/clipping content on narrow phones. `clip` (not
        // `hidden`) so it doesn't become a scroll container and break the sticky
        // header.
        overflowX: 'clip',
      }}
    >
      <PwaShell />
      <RiderChrome>{children}</RiderChrome>
    </div>
  )
}
