import Link from 'next/link'
import { GOLD_HI, INK, INK_DIM, INK_MUTE, LINE, ON_PAPER, ON_PAPER_DIM, primaryCtaLg, ghostCta, ghostCtaPaper } from '@/lib/marketingTheme'
import { litCard, litCardInner, paperCard } from '@/lib/atmosphere'
import { PageHero, Band, Head, Closer } from '../marketing/PageShell'
import MerchCard from './MerchCard'

// Merch catalog. Server-rendered from the merch_products table.
//
// The hero is real footage of the gold badge being worn at a partner bar, not a
// black box with the word "Merch" in it — the whole point of the rebuild was
// that we HAVE this photography and weren't using it.

export function fmtPrice(cents) {
  if (cents == null) return ''
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

const PROMISES = [
  { t: 'Ships to your door', d: 'Order online, we mail it. Nothing to pick up and nothing to remember on the night.' },
  { t: 'Or grab it on the shuttle', d: 'We carry stock on board most weekends. Ask the driver and skip the shipping.' },
]

export default function MerchBody({ products = [] }) {
  const hasProducts = products.length > 0
  return (
    <main className="site-main">
      <PageHero
        image="/brand/photos/merch-hero.jpg"
        position="center 45%"
        kicker="Merch"
        title={<>Wear the <span style={{ color: GOLD_HI }}>gold badge.</span></>}
        sub="Black-and-gold Brew Loop gear, worn by people who actually ride it. Ships to your door, or grab it on the shuttle."
        actions={
          hasProducts
            ? <a href="#shop" style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>Shop the drop</a>
            : <Link href="/events" style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>Book a seat &middot; $20</Link>
        }
      />

      {/* Paper, not panel. See MerchCard: the product shots are cutouts of
          people in black apparel and they disappear on a dark plate. A paper
          band must also hand its children the ON_PAPER tokens — inline styles
          beat a tone flip, so a flip alone renders white-on-cream. */}
      <Band tone="paper" light="top-right" strength={0.13} grain id="shop" tight={!hasProducts}>
        {hasProducts ? (
          <>
            <Head
              kicker="The shop"
              title="Everything in stock."
              tone="paper"
              aside={<Link href="/cart" style={{ ...ghostCtaPaper, padding: '13px 22px' }}>View cart</Link>}
            />
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 38 }}>
              {products.map(p => <MerchCard key={p.id} product={p} />)}
            </div>
          </>
        ) : (
          <div style={{ ...paperCard({ radius: 20 }), maxWidth: 560, margin: '0 auto', padding: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: ON_PAPER, fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>Merch is dropping soon</div>
              <p style={{ color: ON_PAPER_DIM, fontSize: 14.5, lineHeight: 1.6, margin: '12px 0 22px' }}>
                We&rsquo;re stocking the shelves. Until then, the fastest way to get the badge is to be on the shuttle
                when we hand it out.
              </p>
              <Link href="/events" style={{ ...ghostCtaPaper, padding: '14px 22px' }}>See upcoming loops</Link>
            </div>
          </div>
        )}
      </Band>

      <Band tone="base" light="left" strength={0.1} rule>
        <Head
          kicker="How it works"
          title="Two ways to get it."
          sub="One badge, one palette, black and gold either way — it reads as Brew Loop from across a dark bar."
        />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginTop: 36 }}>
          {PROMISES.map(p => (
            <div key={p.t} style={litCard({ radius: 18 })}>
              <div style={litCardInner({ radius: 17, pad: 24 })}>
                <div style={{ color: INK, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>{p.t}</div>
                <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.62, margin: '10px 0 0' }}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: INK_MUTE, fontSize: 14, lineHeight: 1.6, margin: '26px 0 0' }}>
          Sizing or shipping question?{' '}
          <Link href="/contact" style={{ color: GOLD_HI, fontWeight: 700, textDecoration: 'none' }}>Ask us &rarr;</Link>
        </p>
      </Band>

      <Closer
        title={<>The gear is better<br /><span style={{ color: GOLD_HI }}>with a seat under it.</span></>}
        sub="$20 gets you the whole night, every stop on the route, and back to where you started."
        secondary={<Link href="/bars" style={{ ...ghostCta, padding: '17px 26px', fontSize: 15 }}>See the bars</Link>}
      />
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
