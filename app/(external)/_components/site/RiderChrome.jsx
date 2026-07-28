'use client'

// Picks the rider chrome by business: EVERY Brew page gets the real website
// header + footer (one cohesive site), while ALL of Surf/Marines keep today's
// app chrome (TopBar + bottom TabBar) byte-for-byte.
//
// This is the linchpin that lets the Brew redesign ship without touching Surf or
// Marines: any kind !== 'brew' falls straight into the app branch.

import { usePathname } from 'next/navigation'
import { businessFromPath } from '@/lib/businessConfig'
import { CartProvider } from '../merch/CartProvider'
import TopBar from '../TopBar'
import TabBar from '../TabBar'
import LiveStatusStrip from '../LiveStatusStrip'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

export default function RiderChrome({ children }) {
  const pathname = usePathname() || '/'
  const kind = businessFromPath(pathname)
  const isBrew = kind === 'brew'

  return (
    <CartProvider>
      {isBrew ? (
        <>
          <SiteHeader />
          <LiveStatusStrip />
          {children}
          <SiteFooter />
        </>
      ) : (
        <>
          <TopBar />
          <LiveStatusStrip />
          <div style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
            {children}
          </div>
          <TabBar />
        </>
      )}
    </CartProvider>
  )
}
