// Standalone shell for "The Loop" — a fixed-route shuttle. Deliberately NOT
// inside the (external) Brew Loop layout: no Brew Loop top bar / tab bar /
// branding, because under-21 riders are aboard and it must not read as a
// bar-hop service. Dark base + red accent (the "red line"), its own metadata.

import { isLoopAdmin } from '@/lib/loopAdmin'
import { isLoopDriver } from '@/lib/loopDriver'
import LoopStaffNav from './_components/LoopStaffNav'

const BG = '#14181c'
const INK = '#eef1f3'
const RED = '#e5484d'
const RED_DEEP = '#c93b40'
const WARM = '#c9ccd1'
const LINE = 'rgba(255,255,255,0.10)'

export const metadata = {
  title: { default: 'The Loop', template: '%s · The Loop' },
  description: 'The Loop is a fixed-route shuttle. Hop on at the gate, ride the red line to spots all over town, all weekend.',
  openGraph: {
    type: 'website',
    siteName: 'The Loop',
    title: 'The Loop — ride the red line',
    description: 'Hop on at the gate and ride the red line all weekend. ID required to ride.',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: 'The Loop — ride the red line' },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14181c',
}

export default async function LoopLayout({ children }) {
  // Staff (code-cookie) gets the bottom nav; riders never see it. Reserve room
  // at the bottom so the fixed bar doesn't cover page content.
  const [isAdmin, isDriver] = await Promise.all([isLoopAdmin(), isLoopDriver()])
  const staff = isAdmin || isDriver

  return (
    <div className="loop-shell" style={{ minHeight: '100dvh', background: BG, color: INK, WebkitFontSmoothing: 'antialiased',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      paddingBottom: staff ? 'calc(78px + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)' }}>
      {/* the red line */}
      <div aria-hidden style={{ height: 4, background: `linear-gradient(90deg, ${RED_DEEP}, ${RED})` }} />
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(20,24,28,0.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${LINE}`,
        paddingTop: 'env(safe-area-inset-top)' }}>
        <nav style={{ maxWidth: 760, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
          <a href="/marines" aria-label="The Loop home" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${RED}`, color: RED,
              fontSize: 13, fontWeight: 900, letterSpacing: '0.02em', background: 'rgba(229,72,77,0.14)' }}>
              TL
            </span>
            <span style={{ display: 'grid', lineHeight: 1.05 }}>
              <span style={{ color: INK, fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>The Loop</span>
              <span style={{ color: WARM, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Ride the red line</span>
            </span>
          </a>
        </nav>
      </header>
      {children}
      <LoopStaffNav isAdmin={isAdmin} isDriver={isDriver} />
    </div>
  )
}
