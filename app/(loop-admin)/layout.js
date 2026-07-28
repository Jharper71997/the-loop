import NavBar from '../(admin)/_components/NavBar'
import { BusinessProvider } from '../(admin)/_components/BusinessProvider'

// The Loop (Marines) staff console — a separate URL tree (/loop) that reuses the
// exact Brew /admin HUD components, fixed to business='marines'. No toggle.
// Server pages read the same business from the x-business header (set by
// middleware for /loop paths); this provider fixes it for client pages.

export const metadata = {
  title: { default: 'The Loop Admin', template: '%s · The Loop Admin' },
  manifest: '/admin.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Loop Admin',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
}

export default function LoopAdminLayout({ children }) {
  return (
    <div className="hud-shell">
      <BusinessProvider value="marines">
        <NavBar />
        {children}
      </BusinessProvider>
    </div>
  )
}
