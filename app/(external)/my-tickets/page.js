import ExternalNav from '../_components/ExternalNav'
import Footer from '../_components/Footer'
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
    <>
      <ExternalNav />
      <main>
        <section style={{ padding: '56px 20px 24px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <div
            style={{
              color: GOLD,
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            My tickets
          </div>
          <h1 style={{ color: INK }}>Find your ride.</h1>
          <p style={{ marginTop: 14, fontSize: 16 }}>
            Enter the email you booked with and the last 4 digits of your phone number.
          </p>
        </section>

        <section style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px 56px' }}>
          <MyTicketsClient />
        </section>
      </main>
      <Footer />
    </>
  )
}
