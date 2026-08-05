import Link from 'next/link'
import { PUBLIC_PARTNER_BARS, PARTNER_BAR_COUNT } from '@/lib/bars'
import { PageHero, Band, Head, Closer } from '../_components/marketing/PageShell'
import BarTiles from '../_components/marketing/BarTiles'
import { GOLD_HI, INK, INK_DIM, INK_MUTE, primaryCtaLg, ghostCta } from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'

// Brew partner-bar index. (Surf/Marines keep their own /surfcity/bars +
// /marines/bars redirects — only Brew gets this page.)
//
// Same tiles as the homepage via BarTiles, so "All 7 bars" doesn't drop you
// somewhere that looks like a different website.

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

const ROUTE_NOTES = [
  {
    t: 'The route rotates',
    d: 'Not every bar runs every weekend, and Friday can differ from Saturday. The night you book always lists its exact stops.',
  },
  {
    t: 'About an hour and 15 at each stop',
    d: 'Long enough to actually sit down. You get a text roughly 10 minutes before the shuttle rolls so you can close your tab.',
  },
  {
    t: 'You end where you started',
    d: 'The Loop runs between the bars and brings you back to your original pickup. Get there, and home from there, however you like — just not behind your own wheel.',
  },
]

export default function BarsIndex() {
  return (
    <main className="site-main">
      <PageHero
        image="/brand/photos/bars-hero.jpg"
        position="center 38%"
        kicker="Partner bars"
        title={<>The best spots in town,<br /><span style={{ color: GOLD_HI }}>on one route.</span></>}
        sub="These are the bars that ride with the Loop. One seat gets you all of them, and nobody in your group has to drive between stops."
        actions={
          <>
            <Link href="/events" style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>Book a seat &middot; $20</Link>
            <Link href="/track" style={{ ...ghostCta, padding: '16px 24px', fontSize: 15 }}>Find my bus</Link>
          </>
        }
        facts={[`${PARTNER_BAR_COUNT} partner bars`, 'Friday + Saturday', 'Strictly 21+']}
      />

      {/* The lineup */}
      <Band tone="base" light="top-left" strength={0.11} grain>
        <Head
          kicker="The lineup"
          title="Where the shuttle stops."
          aside={<Link href="/events" style={{ ...ghostCta, padding: '13px 22px' }}>See this weekend</Link>}
        />
        <BarTiles bars={PUBLIC_PARTNER_BARS} showBlurb min={250} />
      </Band>

      {/* How the route actually behaves — the questions the grid raises */}
      <Band tone="raised" light="right" strength={0.12} rule>
        <Head kicker="About the route" title="Three things worth knowing." />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', marginTop: 36 }}>
          {ROUTE_NOTES.map(n => (
            <div key={n.t} style={litCard({ radius: 18 })}>
              <div style={litCardInner({ radius: 17, pad: 24 })}>
                <div style={{ color: INK, fontSize: 17.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{n.t}</div>
                <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.62, margin: '10px 0 0' }}>{n.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: INK_MUTE, fontSize: 14, lineHeight: 1.6, margin: '26px 0 0', maxWidth: 640 }}>
          Run a bar in Jacksonville and want on the route?{' '}
          <Link href="/contact?topic=bar" style={{ color: GOLD_HI, fontWeight: 700, textDecoration: 'none' }}>
            Tell us about your spot &rarr;
          </Link>
        </p>
      </Band>

      <Closer
        title={<>See this weekend&rsquo;s<br /><span style={{ color: GOLD_HI }}>exact stops.</span></>}
        sub="Routes rotate, and Friday can differ from Saturday. The event you book always shows that night’s lineup."
        secondary={<Link href="/about" style={{ ...ghostCta, padding: '17px 26px', fontSize: 15 }}>How it works</Link>}
      />
    </main>
  )
}
