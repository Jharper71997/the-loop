import NavBar from './_components/NavBar'

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

export default function AdminLayout({ children }) {
  return (
    <div className="hud-shell">
      <NavBar />
      {children}
    </div>
  )
}
