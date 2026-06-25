import { BARS, SURF_BARS } from '@/lib/bars'
import { prefixLink } from '@/lib/businessConfig'
import TrackMap from '../track/TrackMap'
import CohortRoll from '../track/CohortRoll'

// Shared rider /track body for Brew ('/track') and Surf City ('/surfcity/track').
// Takes the loaded active loop + the business so the partner-bar grid uses the
// right directory and every bar link is prefixed.

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

const CENTERS = {
  brew: { lat: 34.7541, lng: -77.4302 },  // Jacksonville, NC
  surf: { lat: 34.4277, lng: -77.5466 },  // Surf City, NC
}

export default function TrackBody({ data, business = 'brew' }) {
  const fallbackCenter = CENTERS[business] || CENTERS.brew
  return (
    <main style={{ padding: '12px 12px 28px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ padding: '4px 4px 0' }}>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            Live track
          </div>
          <h1 style={{ color: INK, fontSize: 22, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.15 }}>
            {data.loopLabel || 'Shuttle'}
          </h1>
          {data.subtitle && (
            <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>{data.subtitle}</div>
          )}
        </header>

        <TrackMap stops={data.stops} eventDate={data.eventDate} fallbackCenter={fallbackCenter} />

        <CohortRoll />

        <PartnerBars business={business} />
      </div>
    </main>
  )
}

function PartnerBars({ business }) {
  const bars = business === 'surf' ? SURF_BARS : BARS
  return (
    <section
      style={{
        background: SURFACE,
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            On the route
          </div>
          <div style={{ color: INK, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            All {bars.length} partner bars
          </div>
        </div>
        <span style={{ color: INK_DIM, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Route rotates
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: 'repeat(2, 1fr)',
          background: LINE,
        }}
      >
        {bars.map(bar => <BarCell key={bar.slug} bar={bar} business={business} />)}
      </div>
    </section>
  )
}

function BarCell({ bar, business }) {
  return (
    <a
      href={prefixLink(`/bars/${bar.slug}`, business)}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: SURFACE,
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden' }}>
        {bar.heroImage ? (
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,11,0) 40%, rgba(10,10,11,0.85)), url(${bar.heroImage}) center/cover` }} />
        ) : (
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(120% 80% at 50% 30%, rgba(212,163,51,0.18), transparent 70%), #0f0f12',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/badge-gold.png" alt="" width={56} height={56} style={{ opacity: 0.4, display: 'block' }} />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: 10, right: 10, bottom: 8,
            color: INK,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {bar.name}
        </div>
      </div>
    </a>
  )
}
