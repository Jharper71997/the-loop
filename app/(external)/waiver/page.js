import ExternalNav from '../_components/ExternalNav'
import Footer from '../_components/Footer'

export const metadata = {
  title: 'Sign your waiver',
  description: 'Every Brew Loop rider signs a liability waiver before pickup.',
  alternates: { canonical: '/waiver' },
}

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default function WaiverLandingPage() {
  return (
    <>
      <ExternalNav />
      <main>
        <section
          style={{
            padding: '64px 20px 48px',
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
            Find your waiver
          </div>
          <h1 style={{ color: INK }}>Your waiver is a personal link.</h1>
          <p style={{ marginTop: 16, fontSize: 16 }}>
            After you book, we text you a private waiver link tied to your name and phone number.
            Open that text and tap the link to sign.
          </p>

          <div
            style={{
              marginTop: 32,
              padding: '24px 24px 26px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Can&apos;t find the text?
            </div>
            <p style={{ color: INK_DIM, margin: '0 0 12px', fontSize: 15, lineHeight: 1.6 }}>
              Search your messages for <strong style={{ color: INK }}>&ldquo;Brew Loop&rdquo;</strong>, or text us and we&apos;ll resend.
            </p>
            <a
              href="sms:+18448846175&body=Resend%20my%20waiver%20link%20please"
              style={{
                display: 'inline-block',
                padding: '12px 22px',
                borderRadius: 12,
                background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
                color: '#0a0a0b',
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              Text us to resend &rarr;
            </a>
          </div>

          <p style={{ marginTop: 28, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Haven&apos;t booked yet? <a href="/events" style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>See upcoming loops &rarr;</a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
