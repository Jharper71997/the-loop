// The Loop — phone-lookup for your passes. A red-themed fork of Brew Loop's
// /my-tickets, scoped to The Loop (Marines) orders only. No waiver, no security
// chat, no bar/alcohol cues. Boarding-pass links point at /marines/tickets/<code>.

import MarinesMyTicketsClient from './MarinesMyTicketsClient'
import { C, eyebrow } from '../../_theme'

export const metadata = {
  title: 'Your passes',
  description: 'Pull up your passes on The Loop with the phone you booked with.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/marines/my-tickets' },
}

export const dynamic = 'force-dynamic'

export default function MarinesMyTicketsPage() {
  return (
    <main className="external-shell" style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div>
          <div style={eyebrow}>The Loop · Your passes</div>
          <h1 style={{ color: C.INK, fontSize: 28, fontWeight: 800, margin: '10px 0 6px', letterSpacing: '-0.015em', lineHeight: 1.08 }}>
            Find my passes
          </h1>
          <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Enter the phone you booked with and we{"'"}ll pull up every pass on it.
          </p>
        </div>

        <MarinesMyTicketsClient />
      </div>
    </main>
  )
}
