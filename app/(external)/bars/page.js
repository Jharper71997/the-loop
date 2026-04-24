import { BARS } from '@/lib/bars'
import ExternalNav from '../_components/ExternalNav'
import Footer from '../_components/Footer'
import PlaceholderArt from '../_components/PlaceholderArt'

export const metadata = {
  title: 'Partner Bars',
  description: 'Meet the Jacksonville bars on the Brew Loop route. Route rotates weekend to weekend.',
  alternates: { canonical: '/bars' },
  openGraph: {
    title: 'Partner Bars',
    description: 'Eight Jacksonville bars run with the Brew Loop. Route rotates weekend to weekend.',
    url: '/bars',
  },
  twitter: {
    title: 'Partner Bars',
    description: 'Eight Jacksonville bars run with the Brew Loop. Route rotates weekend to weekend.',
  },
}

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default function BarsIndex() {
  return (
    <>
      <ExternalNav />
      <main>
        <section
          style={{
            padding: '56px 20px 32px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
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
              Partner bars
            </div>
            <h1 style={{ color: INK }}>The bars that make the Loop.</h1>
            <p style={{ marginTop: 14, fontSize: 16 }}>
              Eight Jacksonville bars run with us. The route rotates weekend to weekend and can differ Friday vs Saturday
              &mdash; your ticket page shows the exact stops for the night you book.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 72px' }}>
          <div
            style={{
              display: 'grid',
              gap: 18,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            {BARS.map(bar => <BarTile key={bar.slug} bar={bar} />)}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function BarTile({ bar }) {
  return (
    <a
      href={`/bars/${bar.slug}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          aspectRatio: '16/10',
          position: 'relative',
          overflow: 'hidden',
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
          <PlaceholderArt label={bar.name} />
        )}
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        {bar.neighborhood && bar.neighborhood !== 'TBD' && (
          <div
            style={{
              color: GOLD,
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {bar.neighborhood}
          </div>
        )}
        <h3 style={{ color: INK, fontSize: 18, fontWeight: 600, margin: 0 }}>{bar.name}</h3>
        <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>
          {bar.blurb}
        </p>
      </div>
    </a>
  )
}
