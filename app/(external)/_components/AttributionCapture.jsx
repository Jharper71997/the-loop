'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { captureAttribution } from '@/lib/attribution'

// Stores ?ref= / ?qr= / utm tags from whatever rider page a link lands on, so
// the seller still gets credit after the buyer clicks through to /book.
export default function AttributionCapture() {
  const pathname = usePathname()
  useEffect(() => { captureAttribution() }, [pathname])
  return null
}
