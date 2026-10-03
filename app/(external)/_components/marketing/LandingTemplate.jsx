import Link from 'next/link'
import { PUBLIC_PARTNER_BARS } from '@/lib/bars'
import { LANDING_PAGES, getLandingPage, featuredBars } from '@/lib/seoPages'
import { PageHero, Band, Head, Closer } from './PageShell'
import BarTiles from './BarTiles'
import Faq from './Faq'
import JsonLd from '../site/JsonLd'
import {
  GOLD, GOLD_HI, GOLD_INK, INK, INK_DIM,
  ON_PAPER_DIM, ON_PAPER_MUTE,
  primaryCtaLg, ghostCta,
} from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'
import { abs, breadcrumbNode, faqNode, webPageNode, BUSINESS_ID, SERVICE_ID } from '@/lib/jsonLd'

// ONE template for every search-landing page under /jacksonville-nc/<slug>.
//
// The pages themselves are data: lib/seoPages.js holds a record per keyword
// cluster with structured fields (hero, intro, points, faq, related, closer),
// and this file is the only place they are laid out. Add a cluster there and
// the route, the sitemap, the footer and the JSON-LD all pick it up. Nothing
// here should ever need hand-copying into a new page file.
//
// Order of bands follows the rest of the site's dark/paper rhythm:
//   hero (photo) -> intro (paper) -> points (dark) -> bars (dark, base)
//   -> FAQ (paper) -> related (raised) -> closer (void)

export default function LandingTemplate({ page }) {
  const path = `/jacksonville-nc/${page.slug}`
  const related = (page.related || []).map(getLandingPage).filter(Boolean)
  const featured = featuredBars(page.featured)

  return (
    <main className="site-main">
      <PageHero
        image={page.hero.image}
        position={page.hero.position || 'center'}
        kicker={page.hero.kicker}
        title={<>{page.hero.title}<br /><span style={{ color: GOLD_HI }}>{page.hero.highlight}</span></>}
        sub={page.hero.sub}
        actions={
          <>
            <Link href={page.cta?.href || '/events'} style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>
              {page.cta?.label || 'Book a seat · $20'}
            </Link>
            <Link href="/about" style={{ ...ghostCta, padding: '16px 24px', fontSize: 15 }}>How it works</Link>
          </>
        }
        facts={page.facts}
      />

      {/* The answer to the search, in plain prose. Paper: pure type. */}
      <Band tone="paper" light="top-right" strength={0.22} grain rule>
        <Head kicker={page.intro.kicker} title={page.intro.title} tone="paper" />
        <div style={{ maxWidth: 760, marginTop: 26 }}>
          {page.intro.body.map((para, i) => (
            <p key={i} style={{ color: ON_PAPER_DIM, fontSize: 'clamp(16px, 1.8vw, 18px)', lineHeight: 1.68, margin: i ? '16px 0 0' : 0 }}>
              {para}
            </p>
          ))}
        </div>
      </Band>

      {/* Specific partner bars this search is about (karaoke, live music).
          DARK on purpose: bar signs have black baked in and read as pasted
          rectangles on paper. Notes come from each bar's lib/bars.js copy. */}
      {featured.length > 0 && (
        <Band tone="base" light="top-left" strength={0.1} grain rule>
          <Head kicker={page.featured.kicker} title={page.featured.title} />
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 36 }}>
            {featured.map(({ bar, note }) => (
              <Link key={bar.slug} href={`/bars/${bar.slug}`} style={{ textDecoration: 'none' }}>
                <div style={litCard({ radius: 18 })}>
                  <div style={{ ...litCardInner({ radius: 17, pad: 0 }), overflow: 'hidden' }}>
                    {bar.heroImage && (
                      <div style={{ background: '#050506', aspectRatio: '16 / 9', display: 'grid', placeItems: 'center' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bar.heroImage} alt={`${bar.name} sign`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 18, boxSizing: 'border-box', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ padding: 22 }}>
                      <h3 style={{ color: INK, fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>{bar.name}</h3>
                      <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.6, margin: '8px 0 0' }}>{note}</p>
                      <p style={{ color: GOLD, fontSize: 12.5, fontWeight: 600, margin: '12px 0 0' }}>{bar.address}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Band>
      )}

      {/* The practical points, as lit cards */}
      <Band tone="raised" light="left" strength={0.12} rule>
        <Head kicker={page.points.kicker} title={page.points.title} sub={page.points.sub} />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 36 }}>
          {page.points.items.map(it => (
            <div key={it.t} style={litCard({ radius: 18 })}>
              <div style={litCardInner({ radius: 17, pad: 24 })}>
                <h3 style={{ color: INK, fontSize: 17.5, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>{it.t}</h3>
                <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.62, margin: '10px 0 0' }}>{it.d}</p>
                {it.href && (
                  <Link href={it.href} style={{ display: 'inline-block', marginTop: 12, color: GOLD_HI, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                    Read more &rarr;
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </Band>

      {page.showBars && (
        <Band tone="base" light="top-left" strength={0.1} grain rule>
          <Head
            kicker="The partner bars"
            title={page.barsTitle || 'Where the shuttle stops.'}
            sub="The route rotates weekend to weekend, and Friday can differ from Saturday. The night you book always lists its exact stops."
            aside={<Link href="/bars" style={{ ...ghostCta, padding: '13px 22px' }}>All partner bars</Link>}
          />
          <BarTiles bars={PUBLIC_PARTNER_BARS} min={200} />
        </Band>
      )}

      <Band tone="paper" light="right" strength={0.2} grain rule id="faq">
        <Head kicker="FAQ" title={page.faqTitle || 'Questions people ask.'} tone="paper" />
        <Faq items={page.faq} tone="paper" />
        <p style={{ color: ON_PAPER_MUTE, fontSize: 14.5, lineHeight: 1.6, margin: '26px 0 0' }}>
          More answers on{' '}
          <Link href="/about#faq" style={{ color: GOLD_INK, fontWeight: 700, textDecoration: 'none' }}>How It Works</Link>
          , or{' '}
          <Link href="/contact" style={{ color: GOLD_INK, fontWeight: 700, textDecoration: 'none' }}>send us a message</Link>.
        </p>
      </Band>

      {related.length > 0 && (
        <Band tone="base" light="bottom" strength={0.1} rule tight>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
            Keep reading
          </div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 18 }}>
            {related.map(r => (
              <Link key={r.slug} href={`/jacksonville-nc/${r.slug}`} style={{ textDecoration: 'none' }}>
                <div style={litCard({ radius: 16 })}>
                  <div style={litCardInner({ radius: 15, pad: 20 })}>
                    <div style={{ color: INK, fontSize: 16, fontWeight: 800 }}>{r.linkLabel}</div>
                    <div style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.5, marginTop: 6 }}>{r.linkBlurb} &rarr;</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Band>
      )}

      <Closer
        title={<>{page.closer.title}<br /><span style={{ color: GOLD_HI }}>{page.closer.highlight}</span></>}
        sub={page.closer.sub}
        cta={page.cta}
        secondary={<Link href="/bars" style={{ ...ghostCta, padding: '17px 26px', fontSize: 15 }}>See the bars</Link>}
      />

      <JsonLd nodes={[
        {
          ...webPageNode({ path, name: page.meta.title, description: page.meta.description }),
          about: { '@id': SERVICE_ID },
          mentions: { '@id': BUSINESS_ID },
        },
        breadcrumbNode([
          { name: 'Home', path: '/' },
          { name: 'Jacksonville, NC', path: '/jacksonville-nc' },
          { name: page.linkLabel, path },
        ]),
        faqNode(page.faq),
      ]} />
    </main>
  )
}

// The hub at /jacksonville-nc: every landing page, one card each. It exists so
// the cluster pages have a parent in the breadcrumb and a crawlable index.
export function LandingHub() {
  return (
    <main className="site-main">
      <PageHero
        image="/brand/photos/hero-poster.jpg"
        position="center 40%"
        kicker="Jacksonville, NC"
        title={<>A night out in Jacksonville,<br /><span style={{ color: GOLD_HI }}>without the drive.</span></>}
        sub="Guides to bar hopping, nightlife and getting around Jacksonville, NC on a Friday or Saturday night, from the people who run the Brew Loop shuttle."
        actions={<Link href="/events" style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>Book a seat &middot; $20</Link>}
      />
      <Band tone="base" light="top-left" strength={0.1} grain>
        <Head kicker="Guides" title="Pick what you’re planning." />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 32 }}>
          {LANDING_PAGES.map(p => (
            <Link key={p.slug} href={`/jacksonville-nc/${p.slug}`} style={{ textDecoration: 'none' }}>
              <div style={litCard({ radius: 18 })}>
                <div style={litCardInner({ radius: 17, pad: 24 })}>
                  <h2 style={{ color: INK, fontSize: 18, fontWeight: 800, margin: 0 }}>{p.linkLabel}</h2>
                  <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.6, margin: '10px 0 0' }}>{p.linkBlurb} &rarr;</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Band>
      <Closer
        title={<>Pick a night.<br /><span style={{ color: GOLD_HI }}>We’ll handle the driving.</span></>}
        sub="$20 a seat, Friday and Saturday nights, back to your pickup at the end."
      />
      <JsonLd nodes={[
        breadcrumbNode([{ name: 'Home', path: '/' }, { name: 'Jacksonville, NC', path: '/jacksonville-nc' }]),
        {
          '@type': 'ItemList',
          itemListElement: LANDING_PAGES.map((p, i) => ({
            '@type': 'ListItem', position: i + 1, name: p.linkLabel, url: abs(`/jacksonville-nc/${p.slug}`),
          })),
        },
      ]} />
    </main>
  )
}
