// Surf City Loop — phone-lookup for your passes. A gold-themed fork of Brew
// Loop's /my-tickets, scoped to Surf City Loop orders only. No waiver, no
// security chat, no bar/alcohol cues, no ID/verification. Boarding-pass links
// point at /surfcity/tickets/<code>.

import SurfMyTicketsClient from './SurfMyTicketsClient'
import { C, eyebrow } from '../../_theme'

export const metadata = {
  title: 'Your passes',
  description: 'Pull up your passes on the Surf City Loop with the phone you booked with.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/surfcity/my-tickets' },
}

export const dynamic = 'force-dynamic'

export default function SurfMyTicketsPage() {
  return (
    <main className="external-shell" style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div>
          <div style={eyebrow}>Surf City · Your passes</div>
          <h1 style={{ color: C.INK, fontSize: 28, fontWeight: 800, margin: '10px 0 6px', letterSpacing: '-0.015em', lineHeight: 1.08 }}>
            Find my passes
          </h1>
          <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Enter the phone you booked with and we{"'"}ll pull up every pass on it.
          </p>
        </div>

        <SurfMyTicketsClient />
      </div>
    </main>
  )
}
