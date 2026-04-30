import { notFound } from 'next/navigation'
import { BARS, getBar } from '@/lib/bars'
import PlaceholderArt from '../../_components/PlaceholderArt'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export function generateStaticParams() {
  return BARS.map(b => ({ slug: b.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const bar = getBar(slug)
  if (!bar) return { title: 'Partner bar' }
  const neighborhoodBit = bar.neighborhood && bar.neighborhood !== 'TBD' ? ` in ${bar.neighborhood}` : ''
  const desc = `${bar.name} is a Jville Brew Loop partner bar${neighborhoodBit}. ${bar.blurb}`
  const url = `/bars/${bar.slug}`
  return {
    title: bar.name,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: `${bar.name} — Jville Brew Loop`, description: desc, url },
    twitter: { title: `${bar.name} — Jville Brew Loop`, description: desc },
  }
}

export default async function BarDetail({ params }) {
  const { slug } = await params
  const bar = getBar(slug)
  if (!bar) notFound()

  return (
    <main>
        <section
          style={{
            position: 'relative',
            minHeight: 320,
            overflow: 'hidden',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {bar.heroImage ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: `url(${bar.heroImage}) center/cover`,
              }}
            />
          ) : (
            <PlaceholderArt label={bar.name} variant="hero" />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(10,10,11,0.3), rgba(10,10,11,0.85))',
            }}
          />
          <div
            style={{
              position: 'relative',
              maxWidth: 960,
              margin: '0 auto',
              padding: '56px 20px 40px',
              zIndex: 1,
            }}
          >
            <a
              href="/bars"
              style={{
                color: GOLD,
                fontSize: 13,
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-block',
                marginBottom: 16,
              }}
            >
              &larr; All partner bars
            </a>
            {bar.neighborhood && bar.neighborhood !== 'TBD' && (
              <div
                style={{
                  color: GOLD,
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                {bar.neighborhood}
              </div>
            )}
            <h1 style={{ color: INK, margin: 0 }}>{bar.name}</h1>
            <p style={{ marginTop: 14, maxWidth: 640, fontSize: 17 }}>{bar.blurb}</p>
          </div>
        </section>

        <section style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px 32px' }}>
          <div
            style={{
              display: 'grid',
              gap: 18,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            <InfoCard eyebrow="On the Loop" title="A rotating partner">
              {bar.name} is one of eight Jville Brew Loop partner bars. Whether we&apos;re stopping here this
              Friday or Saturday depends on the weekend&apos;s route. Check upcoming events for the exact stops.
            </InfoCard>

            {bar.address && (
              <InfoCard eyebrow="Find it" title="Address">
                {bar.address}
              </InfoCard>
            )}

            <InfoCard eyebrow="How long?" title="~1 hour 15 min per stop">
              You&apos;ll get a text 10 minutes before the shuttle leaves, so you can close your tab and finish your drink.
            </InfoCard>
          </div>

          <div
            style={{
              marginTop: 40,
              padding: '28px 24px',
              borderRadius: 16,
              border: `1px solid ${GOLD}`,
              background: 'linear-gradient(180deg, rgba(212,163,51,0.1), rgba(212,163,51,0.03))',
              textAlign: 'center',
            }}
          >
            <h2 style={{ color: INK, fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>
              See this weekend&apos;s route
            </h2>
            <p style={{ color: INK_DIM, margin: '0 0 18px' }}>
              Routes rotate. The event listing always has the exact stops for each night.
            </p>
            <a
              href="/events"
              style={{
                display: 'inline-block',
                padding: '14px 26px',
                borderRadius: 999,
                background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
                color: '#0a0a0b',
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 10px 30px rgba(212,163,51,0.25)',
              }}
            >
              Browse upcoming loops
            </a>
          </div>
        </section>
    </main>
  )
}

function InfoCard({ eyebrow, title, children }) {
  return (
    <div
      style={{
        padding: '22px 22px 20px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div
        style={{
          color: GOLD,
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h3 style={{ color: INK, fontSize: 17, fontWeight: 600, margin: '0 0 10px' }}>{title}</h3>
      <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  )
}
