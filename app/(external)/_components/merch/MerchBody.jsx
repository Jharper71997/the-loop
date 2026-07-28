import {
  GOLD_HI, INK, INK_DIM, LINE, MAX_W, softCard, eyebrow, pulseDot, HERO_GLOW,
} from '@/lib/marketingTheme'
import MerchCard from './MerchCard'

// Merch catalog grid. Server-rendered from the merch_products table.

export function fmtPrice(cents) {
  if (cents == null) return ''
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

export default function MerchBody({ products = [] }) {
  return (
    <main className="site-main">
      <section style={{ position: 'relative', padding: 'clamp(44px, 8vw, 76px) 16px clamp(24px, 4vw, 40px)' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: HERO_GLOW, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto' }}>
          <div style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span style={pulseDot} /> Merch
          </div>
          <h1 style={{ color: INK, fontSize: 'clamp(30px, 6vw, 50px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.06, margin: '14px 0 0' }}>
            Wear the <span style={{ color: GOLD_HI }}>gold badge.</span>
          </h1>
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2.2vw, 18px)', lineHeight: 1.55, margin: '16px 0 0', maxWidth: 560 }}>
            Black-and-gold Brew Loop gear. Ships to your door, or grab it on the shuttle.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: MAX_W, margin: '0 auto', padding: '8px 16px clamp(48px, 7vw, 76px)' }}>
        {!products.length ? (
          <div style={{ ...softCard, textAlign: 'center', padding: '48px 24px', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ color: INK, fontWeight: 700, fontSize: 18 }}>Merch is dropping soon</div>
            <p style={{ color: INK_DIM, fontSize: 14.5, margin: '10px 0 0' }}>
              We&rsquo;re stocking the shelves. Check back shortly, or follow us for the drop.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {products.map(p => <MerchCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </main>
  )
}

export function MerchImage({ image, name, tall }) {
  if (image) {
    return (
      <div aria-hidden style={{ width: '100%', aspectRatio: tall ? '4 / 5' : '1 / 1', background: `url(${image}) center/cover`, borderBottom: `1px solid ${LINE}` }} />
    )
  }
  // Branded placeholder until real photos land.
  return (
    <div
      aria-hidden
      style={{
        width: '100%',
        aspectRatio: tall ? '4 / 5' : '1 / 1',
        display: 'grid',
        placeItems: 'center',
        borderBottom: `1px solid ${LINE}`,
        background: 'radial-gradient(90% 80% at 50% 20%, rgba(212,163,51,0.18), transparent 60%), #101014',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/badge-gold.png" alt="" style={{ width: 84, height: 84, objectFit: 'contain', opacity: 0.92 }} />
    </div>
  )
}
