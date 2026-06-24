// Surf City Loop header + staff nav. Mirrors marines/layout.js but with Surf
// City branding, /surfcity routes, and the Surf code gates. Renders the soft
// rider header for riders, or the terminal staff nav for staff (surf_admin /
// surf_driver cookies). Same black+gold look as Brew Loop.

import { isSurfAdmin } from '@/lib/surfAdmin'
import { isSurfDriver } from '@/lib/surfDriver'
import SurfStaffNav from '../_components/SurfStaffNav'

const INK = '#e8e8ea'
const GOLD = '#d4a333'
const WARM = '#c9ccd1'
const LINE = 'rgba(255,255,255,0.10)'

export const metadata = {
  title: { default: 'Surf City Loop', template: '%s · Surf City Loop' },
  description: 'Surf City Loop is a weekend bar-hop shuttle on Topsail Island. One ride, every stop, no driving.',
  openGraph: {
    type: 'website',
    siteName: 'Surf City Loop',
    title: 'Surf City Loop — ride with friends, skip the drive',
    description: 'One ride, every stop, all weekend on Topsail Island.',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: 'Surf City Loop' },
}

export default async function SurfcityLayout({ children }) {
  const [isAdmin, isDriver] = await Promise.all([isSurfAdmin(), isSurfDriver()])
  const staff = isAdmin || isDriver

  return (
    <>
      {staff ? (
        <SurfStaffNav isAdmin={isAdmin} isDriver={isDriver} />
      ) : (
        <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(10,10,11,0.92)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${LINE}`,
          paddingTop: 'env(safe-area-inset-top)' }}>
          <nav style={{ maxWidth: 760, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
            <a href="/surfcity" aria-label="Surf City Loop home" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
              <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${GOLD}`, color: GOLD,
                fontSize: 13, fontWeight: 900, letterSpacing: '0.02em', background: 'rgba(212,163,51,0.14)' }}>
                SC
              </span>
              <span style={{ display: 'grid', lineHeight: 1.05 }}>
                <span style={{ color: INK, fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Surf City Loop</span>
                <span style={{ color: WARM, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Ride with friends</span>
              </span>
            </a>
          </nav>
        </header>
      )}
      {children}
    </>
  )
}
