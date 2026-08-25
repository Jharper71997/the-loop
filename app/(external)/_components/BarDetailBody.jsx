import Link from 'next/link'
import { brandFor, prefixLink } from '@/lib/businessConfig'
import { PUBLIC_PARTNER_BARS } from '@/lib/bars'
import PlaceholderArt from './PlaceholderArt'
import { Band, Head } from './marketing/PageShell'
import BarTiles from './marketing/BarTiles'
import { litCard, litCardInner, lightPool, grainOverlay } from '@/lib/atmosphere'
import { GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, MAX_W, ON_PAPER_DIM, primaryCtaLg, ghostCta } from '@/lib/marketingTheme'

// Shared partner-bar detail body for Brew ('/bars/[slug]') and Surf City
// ('/surfcity/bars/[slug]'). Takes the resolved bar + business so links are
// prefixed and copy reads with the right brand.
//
// Rebuilt 2026-08-05. The old version printed the bar name and a "Back to
// Track" link directly ON TOP of the bar's logo — these are SIGNS, not scenery,
// so as a full-bleed background they were both unreadable and defaced the
// artwork. It also sat in a 960px column while the rest of the site runs 1320,
// which made every tile click feel like leaving the website.
//
// Now: the sign gets its own lit plate beside the copy, the page uses the same
// bands as / and /bars, and the back link goes back to the bar index you came
// from rather than to the live tracker.

export default function BarDetailBody({ bar, business = 'brew' }) {
  const cfg = brandFor(business)
  const isBrew = business === 'brew'
  const others = isBrew ? PUBLIC_PARTNER_BARS.filter(b => b.slug !== bar.slug) : []

  return (
    <main className="site-main">
      {/* Hero — sign on a plate, copy beside it. Never text over the logo. */}
      <section style={{ position: 'relative', overflow: 'hidden', background: '#08080a' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-right', 0.16) }} />
        <div aria-hidden style={grainOverlay} />

        <div className="bd-hero" style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(28px, 5vw, 56px) 24px clamp(44px, 6vw, 72px)' }}>
          <div>
            <Link href={prefixLink('/bars', business)} style={backLink}>
              &larr; All partner bars
            </Link>

            {bar.neighborhood && bar.neighborhood !== 'TBD' && (
              <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, marginTop: 22 }}>
                {bar.neighborhood}
              </div>
            )}

            <h1 style={{
              color: INK, fontSize: 'clamp(34px, 5.6vw, 60px)', fontWeight: 800,
              letterSpacing: '-0.03em', lineHeight: 1.03, margin: '12px 0 0',
            }}>
              {bar.name}
            </h1>

            {bar.blurb && (
              <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 19px)', lineHeight: 1.55, margin: '18px 0 0', maxWidth: 520 }}>
                {bar.blurb}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
              <Link href={prefixLink('/events', business)} style={{ ...primaryCtaLg, padding: '16px 28px' }}>
                Book a seat
              </Link>
              {bar.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${bar.name} ${bar.address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...ghostCta, padding: '16px 24px', fontSize: 15 }}
                >
                  Open in Maps
                </a>
              )}
            </div>
          </div>

          {/* The sign, on its own plate — contained, lit, never cropped. */}
          <div style={litCard({ radius: 22 })}>
            <div style={{ ...litCardInner({ radius: 21, pad: 0 }), display: 'grid', placeItems: 'center', aspectRatio: '4 / 3' }}>
              {bar.heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bar.heroImage}
                  alt={`${bar.name} sign`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 26, boxSizing: 'border-box', display: 'block' }}
                />
              ) : (
                <PlaceholderArt label={bar.name} variant="hero" />
              )}
            </div>
          </div>
        </div>
        <style>{`
          .bd-hero { display: grid; gap: 34px; align-items: center; }
          @media (min-width: 900px) {
            .bd-hero { grid-template-columns: 1.05fr 0.95fr; gap: 56px; }
          }
        `}</style>
      </section>

      {/* The venue in its own right, written from each bar's own site and
          listing. Only the Brew partner bars carry a description; Surf and
          Marines stops have none and fall straight through to the generic
          cards below. */}
      {bar.description && (
        <Band tone="paper" light="right" strength={0.2} grain rule>
          <Head kicker="The place" title={`About ${bar.name}.`} tone="paper" />
          <p
            style={{
              color: ON_PAPER_DIM,
              fontSize: 'clamp(16px, 1.8vw, 19px)',
              lineHeight: 1.65,
              margin: '26px 0 0',
              maxWidth: 720,
            }}
          >
            {bar.description}
          </p>
        </Band>
      )}

      {/* What a stop here is actually like */}
      <Band tone="raised" light="left" strength={0.12} rule>
        <Head kicker="Stopping here" title="What to expect." />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 36 }}>
          <InfoCard eyebrow="On the route" title="A rotating partner">
            {bar.name} is one of the {cfg.brand}{' '}partner bars. Whether we&apos;re stopping here on a given night
            depends on that weekend&apos;s route, so check the event you&apos;re booking for its exact stops.
          </InfoCard>

          {bar.address && (
            <InfoCard eyebrow="Find it" title="Address">
              {bar.address}
            </InfoCard>
          )}

          <InfoCard eyebrow="How long" title="~1 hour 15 min per stop">
            You&apos;ll get a text about 10 minutes before the shuttle leaves, so you can close your tab and finish
            your drink.
          </InfoCard>
        </div>
      </Band>

      {/* Their own photos, when we have them. The sign shows you what to look
          for; this shows you what the room is actually like. Only Brassa has
          these today, so the band is skipped entirely rather than rendering an
          empty shell. */}
      {bar.photos?.length > 0 && (
        <Band tone="base" light="right" strength={0.1} grain rule>
          <Head kicker="Inside" title={`A look at ${bar.name}.`} />
          <div className="bd-gallery">
            {bar.photos.map(photo => (
              <div key={photo.src} style={litCard({ radius: 20 })}>
                <div style={{ ...litCardInner({ radius: 19, pad: 0 }), overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={photo.alt || ''}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '4 / 5', display: 'block' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <style>{`
            .bd-gallery {
              display: grid; gap: 16px; margin-top: 36px;
              grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            }
          `}</style>
        </Band>
      )}

      {/* The rest of the route (Brew only — BarTiles links to /bars/[slug]) */}
      {others.length > 0 && (
        <Band tone="base" light="top-left" strength={0.1} grain rule>
          <Head
            kicker="The rest of the route"
            title="Where else the shuttle stops."
            aside={<Link href="/bars" style={{ ...ghostCta, padding: '13px 22px' }}>All partner bars</Link>}
          />
          <BarTiles bars={others} min={200} />
        </Band>
      )}

      {/* Closer */}
      <Band tone="void" light="bottom" strength={0.2} grain rule>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: INK, fontSize: 'clamp(26px, 4.2vw, 42px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.06, margin: '0 auto', maxWidth: 620 }}>
            See this weekend&rsquo;s <span style={{ color: GOLD_HI }}>exact stops.</span>
          </h2>
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.55, margin: '18px auto 0', maxWidth: 500 }}>
            Routes rotate, and Friday can differ from Saturday. The event listing always has the lineup for that night.
          </p>
          <div style={{ marginTop: 30 }}>
            <Link href={prefixLink('/events', business)} style={{ ...primaryCtaLg, padding: '17px 34px', fontSize: 17 }}>
              Book a seat
            </Link>
          </div>
        </div>
      </Band>
    </main>
  )
}

function InfoCard({ eyebrow, title, children }) {
  return (
    <div style={litCard({ radius: 18 })}>
      <div style={litCardInner({ radius: 17, pad: 24 })}>
        <div style={{ color: GOLD, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
          {eyebrow}
        </div>
        <h3 style={{ color: INK, fontSize: 17.5, fontWeight: 800, letterSpacing: '-0.01em', margin: '10px 0 0' }}>{title}</h3>
        <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.62, margin: '10px 0 0' }}>{children}</p>
      </div>
    </div>
  )
}

const backLink = {
  color: INK_MUTE, fontSize: 13.5, fontWeight: 600,
  textDecoration: 'none', display: 'inline-block',
}
