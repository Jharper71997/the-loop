import Link from 'next/link'
import { BARS } from '@/lib/bars'
import {
  GOLD, GOLD_HI, INK, INK_DIM, LINE, MAX_W,
  primaryCta, ghostCta, eyebrow, softCard, pulseDot, HERO_GLOW,
} from '@/lib/marketingTheme'

// Brew partner-bar index. (Surf/Marines keep their own /surfcity/bars +
// /marines/bars redirects — only Brew gets this page.)

export const metadata = {
  title: 'Partner Bars',
  description:
    'The partner bars on the Jville Brew Loop. Ride the shuttle between Jacksonville’s best spots all night, nobody drives between stops.',
  alternates: { canonical: '/bars' },
  openGraph: {
    title: 'Brew Loop Partner Bars',
    description: 'The best spots in Jacksonville, on one route. Ride the Loop between them all night.',
    url: '/bars',
  },
}

const PARTNER_BARS = BARS.filter(b => b.address && b.slug !== 'partner-8')

// Initials for the fallback badge on bars without a logo (drops "The", punctuation).
function barInitials(name) {
  const words = String(name).replace(/^the\s+/i, '').replace(/[^\w\s]/g, '').trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return words[0].slice(0, 1).toUpperCase()
}

export default function BarsIndex() {
  return (
    <main className="site-main">
      {/* Hero */}
      <section style={{ position: 'relative', padding: 'clamp(44px, 8vw, 76px) 16px clamp(28px, 5vw, 44px)' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: HERO_GLOW, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto' }}>
          <div style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span style={pulseDot} /> Partner bars
          </div>
          <h1 style={{ color: INK, fontSize: 'clamp(30px, 6vw, 50px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.06, margin: '14px 0 0' }}>
            The best spots in Jacksonville,<br /><span style={{ color: GOLD_HI }}>on one route.</span>
          </h1>
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2.2vw, 18px)', lineHeight: 1.55, margin: '16px 0 0', maxWidth: 580 }}>
            These are the partner bars that ride with the Loop. The route rotates weekend to weekend, so the exact stops for
            any given night live on that night&rsquo;s event. Here&rsquo;s the full lineup.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section style={{ maxWidth: MAX_W, margin: '0 auto', padding: '8px 16px clamp(40px, 6vw, 64px)' }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {PARTNER_BARS.map(b => (
            <Link key={b.slug} href={`/bars/${b.slug}`} style={{ ...softCard, padding: '20px 20px', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  aria-hidden
                  style={b.logo
                    ? { width: 46, height: 46, borderRadius: 11, flex: '0 0 auto', border: `1px solid ${LINE}`, background: `url(${b.logo}) center/cover` }
                    : { width: 46, height: 46, borderRadius: 11, flex: '0 0 auto', display: 'grid', placeItems: 'center', border: '1px solid rgba(212,163,51,0.28)', background: 'rgba(212,163,51,0.12)', color: GOLD_HI, fontWeight: 800, fontSize: 15, letterSpacing: '0.02em' }}
                >
                  {b.logo ? '' : barInitials(b.name)}
                </span>
                {b.neighborhood && b.neighborhood !== 'TBD' && (
                  <span style={{ color: GOLD, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>{b.neighborhood}</span>
                )}
              </div>
              <div style={{ color: INK, fontSize: 19, fontWeight: 800, margin: '12px 0 0' }}>{b.name}</div>
              {b.blurb && <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, margin: '10px 0 16px' }}>{b.blurb}</p>}
              <span style={{ marginTop: 'auto', color: GOLD_HI, fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                View details <span aria-hidden>&rarr;</span>
              </span>
            </Link>
          ))}
        </div>

        {/* CTA band */}
        <div style={{ ...softCard, marginTop: 28, padding: 'clamp(28px, 5vw, 44px) 24px', textAlign: 'center', border: `1px solid rgba(212,163,51,0.28)`, background: 'linear-gradient(180deg, rgba(212,163,51,0.08), transparent)' }}>
          <h2 style={{ color: INK, fontSize: 'clamp(20px, 3.4vw, 28px)', fontWeight: 800, margin: 0 }}>See this weekend&rsquo;s route</h2>
          <p style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.55, margin: '10px auto 0', maxWidth: 520 }}>
            Routes rotate, and Friday can differ from Saturday. The event you book always shows that night&rsquo;s exact stops.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
            <Link href="/events" style={primaryCta}>Browse upcoming loops</Link>
            <Link href="/track" style={ghostCta}>Find my bus</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
