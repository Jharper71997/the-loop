import ExternalNav from '../../_components/ExternalNav'
import WaiverForm from './WaiverForm'

export const metadata = {
  title: 'Sign waiver',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default async function WaiverPage({ params }) {
  const { contactId } = await params
  return (
    <>
      <ExternalNav />
      <main>
        <section
          style={{
            padding: '40px 20px 24px',
            maxWidth: 640,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
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
            Liability waiver
          </div>
          <h1 style={{ color: INK, fontSize: 30, lineHeight: 1.1 }}>
            30 seconds. Then you&apos;re clear to ride.
          </h1>
          <p style={{ color: INK_DIM, marginTop: 12, fontSize: 15 }}>
            Every Brew Loop rider signs one before pickup. Type your legal name below.
          </p>
        </section>

        <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 56px' }}>
          <WaiverForm contactId={contactId} />
        </section>
      </main>
    </>
  )
}
