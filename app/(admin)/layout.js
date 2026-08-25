import ConsoleShell from '../_components/console/ConsoleShell'
import { BusinessProvider } from './_components/BusinessProvider'

export const metadata = {
  title: { default: 'Brew Loop Admin', template: '%s · Brew Loop Admin' },
  manifest: '/admin.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BL Admin',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
}

// Brew staff console. Shares ConsoleShell with /leadership so the two read as
// one product — see app/_components/console/sections.js for the five-entry nav.
// Surf (/surf) and Marines (/loop) keep the older NavBar for now; they are
// separate route groups and untouched by this.
export default function AdminLayout({ children }) {
  return (
    <BusinessProvider value="brew">
      <ConsoleShell>{children}</ConsoleShell>
    </BusinessProvider>
  )
}
