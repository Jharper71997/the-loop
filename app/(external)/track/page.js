import ShuttleMap from './ShuttleMap'

const LOOP_PHONE = '16362661801' // (636) 266-1801 — rider text line

export const metadata = {
  title: 'Live Shuttle',
  description: 'Track the Brew Loop shuttle live between Jacksonville partner bars.',
  alternates: { canonical: '/track' },
  openGraph: {
    title: 'Live Shuttle',
    description: 'Track the Brew Loop shuttle live between Jacksonville partner bars.',
    url: '/track',
  },
  twitter: {
    title: 'Live Shuttle',
    description: 'Track the Brew Loop shuttle live between Jacksonville partner bars.',
  },
}

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default function TrackPage() {
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 68px)',
          background: '#0a0a0b',
        }}
      >
        <section
          style={{
            padding: '20px 20px 16px',
            maxWidth: 1100,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  color: GOLD,
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: GOLD,
                  boxShadow: `0 0 10px ${GOLD}`,
                  animation: 'trackPulse 1.6s ease-out infinite',
                }} />
                Live shuttle
              </div>
              <h1 style={{ color: INK, fontSize: 22, margin: 0, fontWeight: 600 }}>
                Track tonight&apos;s Loop
              </h1>
              <p style={{ color: INK_DIM, fontSize: 14, margin: '4px 0 0' }}>
                Stops are ~1 hour 15 min each. You&apos;ll get a text 10 minutes before the shuttle rolls.
              </p>
            </div>

            <a
              href={`sms:+${LOOP_PHONE}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 999,
                border: `1px solid ${GOLD}`,
                background: 'rgba(212,163,51,0.08)',
                color: GOLD,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              <span aria-hidden>&#9742;</span>
              Text the Loop
            </a>
          </div>
        </section>

        <div
          style={{
            flex: 1,
            position: 'relative',
            minHeight: 420,
            margin: '0 20px 24px',
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <ShuttleMap />
        </div>

        <section style={{ maxWidth: 1100, margin: '0 auto 48px', padding: '0 20px', width: '100%' }}>
          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}
          >
            <TipCard
              title="Don&apos;t see the bus?"
              body="The dot only shows when the shuttle is moving. Between stops it parks at the bar."
            />
            <TipCard
              title="Lost your ride?"
              body="Text us and we&apos;ll get you back on the Loop. We don&apos;t leave anyone behind."
            />
            <TipCard
              title="Not on tonight&apos;s Loop?"
              body={
                <>
                  Grab a seat for the next one on{' '}
                  <a href="/events" style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>/events</a>.
                </>
              }
            />
          </div>
        </section>
      </div>

      <style>{`
        @keyframes trackPulse {
          0% { box-shadow: 0 0 0 0 rgba(212,163,51,0.5); }
          100% { box-shadow: 0 0 0 14px rgba(212,163,51,0); }
        }
      `}</style>
    </>
  )
}

function TipCard({ title, body }) {
  return (
    <div
      style={{
        padding: '18px 20px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
      }}
    >
      <div
        style={{ color: INK, fontWeight: 600, fontSize: 14, marginBottom: 6 }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <div style={{ color: INK_DIM, fontSize: 13, lineHeight: 1.55 }}>
        {body}
      </div>
    </div>
  )
}
