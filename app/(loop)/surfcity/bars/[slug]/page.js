import { notFound } from 'next/navigation'
import { brandFor } from '@/lib/businessConfig'
import { SURF_BARS, getSurfBar } from '@/lib/bars'
import { C, card, eyebrow, sectionLabel, primaryCta, ghostCta } from '../../../_theme'

// Surf City Loop — single partner-stop page. Modeled on the Brew
// (external)/bars/[slug] page but black+gold themed (via _theme) and Surf City
// branded. Copy is neutral — no alcohol marketing, no drink deals, no outcome
// promises. SURF_BARS coords/addresses are null, so this gracefully omits the
// map/pin and the address block until those are filled in.

const cfg = brandFor('surf')

export function generateStaticParams() {
  return SURF_BARS.map(b => ({ slug: b.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const bar = getSurfBar(slug)
  if (!bar) return { title: 'Partner stop' }
  const neighborhoodBit = bar.neighborhood && bar.neighborhood !== 'TBD' ? ` in ${bar.neighborhood}` : ''
  const desc = `${bar.name} is a ${cfg.brand} partner stop${neighborhoodBit}.`
  const url = `${cfg.basePath}/bars/${bar.slug}`
  return {
    title: bar.name,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: `${bar.name} — ${cfg.brand}`, description: desc, url },
    twitter: { title: `${bar.name} — ${cfg.brand}`, description: desc },
  }
}

const softCard = { ...card, borderRadius: 16, boxShadow: '0 14px 30px rgba(0,0,0,0.22)' }
const hasCoords = bar => Number.isFinite(bar?.lat) && Number.isFinite(bar?.lng)

export default async function SurfBarDetail({ params }) {
  const { slug } = await params
  const bar = getSurfBar(slug)
  if (!bar) notFound()

  const mapsHref = bar.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bar.address)}`
    : hasCoords(bar)
      ? `https://www.google.com/maps/search/?api=1&query=${bar.lat},${bar.lng}`
      : null

  return (
    <main className="external-shell" style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 14 }}>

        <header style={{ padding: '4px 4px 0' }}>
          <a href={`${cfg.basePath}/bars`} style={{ color: C.GOLD, fontSize: 13, textDecoration: 'none', fontWeight: 600, display: 'inline-block', marginBottom: 12 }}>
            ← All partner stops
          </a>
          <div style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.GOLD, boxShadow: `0 0 10px ${C.GOLD}`, display: 'inline-block' }} />
            {bar.neighborhood && bar.neighborhood !== 'TBD' ? bar.neighborhood : `${cfg.shortBrand} partner stop`}
          </div>
          <h1 style={{ color: C.INK, fontSize: 30, fontWeight: 800, margin: '8px 0 0', lineHeight: 1.06, letterSpacing: '-0.015em' }}>
            {bar.name}
          </h1>
          {bar.blurb && (
            <p style={{ color: C.INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: '10px 0 0' }}>{bar.blurb}</p>
          )}
        </header>

        <section>
          <div style={sectionLabel}>On the loop</div>
          <div style={{ ...softCard, padding: '16px 16px', marginTop: 8 }}>
            <div style={{ color: C.INK, fontSize: 15, fontWeight: 700 }}>A stop on the route</div>
            <p style={{ color: C.INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '6px 0 0' }}>
              {bar.name} is one of the {cfg.brand} partner stops. Which stops run on a given weekend
              depends on the route, so check the live map for this weekend{"'"}s exact stops.
            </p>
          </div>
        </section>

        {bar.address && (
          <section>
            <div style={sectionLabel}>Find it</div>
            <div style={{ ...softCard, padding: '16px 16px', marginTop: 8 }}>
              <div style={{ color: C.INK, fontSize: 14, fontWeight: 600 }}>{bar.address}</div>
              {mapsHref && (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ ...ghostCta, marginTop: 12 }}>
                  Open in Maps
                </a>
              )}
            </div>
          </section>
        )}

        <section style={{ ...softCard, padding: '22px 18px', textAlign: 'center' }}>
          <div style={{ color: C.INK, fontSize: 17, fontWeight: 800 }}>Ride the loop</div>
          <div style={{ color: C.INK_DIM, fontSize: 13.5, margin: '6px 0 14px' }}>
            Grab a seat and ride with friends across the stops.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`${cfg.basePath}/buy`} style={primaryCta}>Get a ride</a>
            <a href={cfg.trackPath} style={ghostCta}>See it live</a>
          </div>
        </section>

      </div>
    </main>
  )
}
