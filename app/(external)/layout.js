import PwaShell from './_components/PwaShell'
import TabBar from './_components/TabBar'

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
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/flyers/jbl-logo-gold.png', sizes: '180x180' }],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
}

export default function ExternalLayout({ children }) {
  return (
    <div
      className="external-shell"
      style={{
        minHeight: '100dvh',
        background: '#0a0a0b',
        color: '#f5f5f7',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
      }}
    >
      <PwaShell />
      {children}
      <TabBar />
    </div>
  )
}
