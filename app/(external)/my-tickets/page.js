import MyTicketsClient from './MyTicketsClient'

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
    <main style={{ padding: '24px 16px 32px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header style={{ paddingTop: 8 }}>
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
          <h1 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '6px 0 0' }}>
            Find your ride.
          </h1>
          <p style={{ color: '#b8b8bf', fontSize: 14, margin: '6px 0 0' }}>
            Enter the email you booked with and the last 4 digits of your phone.
          </p>
        </header>

        <MyTicketsClient />
      </div>
    </main>
  )
}
