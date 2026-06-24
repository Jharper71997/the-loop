// Marines "The Loop" header + staff nav. Moved out of (loop)/layout.js when
// Surf City Loop was added so each business owns its own chrome. Renders the
// soft rider header for riders, or the Brew-style terminal nav for staff
// (code-cookie). Metadata is Marines-specific.

import { isLoopAdmin } from '@/lib/loopAdmin'
import { isLoopDriver } from '@/lib/loopDriver'
import LoopStaffNav from '../_components/LoopStaffNav'

const INK = '#e8e8ea'
const GOLD = '#d4a333'
const WARM = '#c9ccd1'
const LINE = 'rgba(255,255,255,0.10)'

export const metadata = {
  title: { default: 'The Loop', template: '%s · The Loop' },
  description: 'The Loop is a fixed-route shuttle. Hop on at the gate and ride the loop to spots all over town, all weekend.',
  openGraph: {
    type: 'website',
    siteName: 'The Loop',
    title: 'The Loop — ride the loop',
    description: 'Hop on at the gate and ride the loop all weekend. ID required to ride.',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: 'The Loop — ride the loop' },
}

export default async function MarinesLayout({ children }) {
  const [isAdmin, isDriver] = await Promise.all([isLoopAdmin(), isLoopDriver()])
  const staff = isAdmin || isDriver

  return (
    <>
      {staff ? (
        <LoopStaffNav isAdmin={isAdmin} isDriver={isDriver} />
      ) : (
        <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(10,10,11,0.92)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${LINE}`,
          paddingTop: 'env(safe-area-inset-top)' }}>
          <nav style={{ maxWidth: 760, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
            <a href="/marines" aria-label="The Loop home" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
              <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${GOLD}`, color: GOLD,
                fontSize: 13, fontWeight: 900, letterSpacing: '0.02em', background: 'rgba(212,163,51,0.14)' }}>
                TL
              </span>
              <span style={{ display: 'grid', lineHeight: 1.05 }}>
                <span style={{ color: INK, fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>The Loop</span>
                <span style={{ color: WARM, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Ride the loop</span>
              </span>
            </a>
          </nav>
        </header>
      )}
      {children}
    </>
  )
}
