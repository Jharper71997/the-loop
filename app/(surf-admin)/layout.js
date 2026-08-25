import NavBar from '../(admin)/_components/NavBar'
import { BusinessProvider } from '../(admin)/_components/BusinessProvider'

// Surf City staff console — a separate URL tree (/surf) that reuses the exact
// Brew /admin HUD components, fixed to business='surf'. No toggle. Server pages
// read the same business from the x-business header (set by middleware for /surf
// paths); this provider fixes it for client pages.

export const metadata = {
  title: { default: 'Surf City Admin', template: '%s · Surf City Admin' },
  manifest: '/admin.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Surf Admin',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
}

export default function SurfAdminLayout({ children }) {
  return (
    <div className="hud-shell">
      <BusinessProvider value="surf">
        <NavBar />
        {children}
      </BusinessProvider>
    </div>
  )
}
