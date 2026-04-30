import { BARS } from '@/lib/bars'
import Image from 'next/image'

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
    <main>
        <section
          style={{
            padding: '20px 16px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Partner bars
            </div>
            <h1 style={{ color: INK, fontSize: 'clamp(22px, 6vw, 28px)', margin: '6px 0 4px' }}>The Loop route.</h1>
            <p style={{ marginTop: 4, fontSize: 14, color: INK_DIM }}>
              Eight bars run with us. Route rotates weekend to weekend. Your ticket page shows the night&rsquo;s exact stops.
            </p>
          </div>
        </section>

        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 32px' }}>
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
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(120% 80% at 50% 30%, rgba(212,163,51,0.18), transparent 70%), #0f0f12',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image src="/brand/badge-gold.png" alt="" width={96} height={96} style={{ opacity: 0.4 }} />
          </div>
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
