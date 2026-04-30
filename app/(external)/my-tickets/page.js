import MyTicketsClient from './MyTicketsClient'
import Image from 'next/image'

export const metadata = {
  title: 'My Tickets',
  description: 'Look up your Brew Loop tickets and waiver status.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/my-tickets' },
}

const GOLD = '#d4a333'
const INK = '#f5f5f7'

export default function MyTicketsPage() {
  return (
    <main style={{ padding: '16px 16px 24px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image
            src="/brand/badge-gold.png"
            alt=""
            width={44}
            height={44}
            style={{ opacity: 0.9, flex: '0 0 auto' }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              My tickets
            </div>
            <h1 style={{ color: INK, fontSize: 22, fontWeight: 800, margin: '2px 0 0', lineHeight: 1.15 }}>
              Find your ride.
            </h1>
          </div>
        </header>

        <p style={{ color: '#b8b8bf', fontSize: 14, margin: 0 }}>
          Enter the phone you booked with. We&rsquo;ll show your tickets and waiver.
        </p>

        <MyTicketsClient />
      </div>
    </main>
  )
}
