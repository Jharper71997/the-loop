// Surf City Loop — partner stops directory. Modeled on the Brew (external)/bars
// pages but black+gold themed (via _theme) and Surf City branded. Lists the
// SURF_BARS partner stops. Copy is neutral — no alcohol marketing, no drink
// deals, no outcome promises. SURF_BARS have no coords/addresses yet, so this
// list page just links each stop to its detail page.

import { brandFor } from '@/lib/businessConfig'
import { SURF_BARS } from '@/lib/bars'
import { C, card, eyebrow, sectionLabel, primaryCta, ghostCta } from '../../_theme'

const cfg = brandFor('surf')

export const metadata = {
  title: 'Partner stops',
  description: 'The partner stops on the Surf City Loop route across Topsail Island.',
  alternates: { canonical: `${cfg.basePath}/bars` },
}

const softCard = { ...card, borderRadius: 16, boxShadow: '0 14px 30px rgba(0,0,0,0.22)' }

export default function SurfBarsIndex() {
  return (
    <main className="external-shell" style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 14 }}>

        <header style={{ padding: '4px 4px 0' }}>
          <div style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.GOLD, boxShadow: `0 0 10px ${C.GOLD}`, display: 'inline-block' }} />
            {cfg.shortBrand} · Partner stops
          </div>
          <h1 style={{ color: C.INK, fontSize: 28, fontWeight: 800, margin: '8px 0 0', lineHeight: 1.08, letterSpacing: '-0.015em' }}>
            The stops on the route
          </h1>
          <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: '8px 0 0' }}>
            These are the partner stops the {cfg.brand} runs across Topsail Island. The route can change
            weekend to weekend, so check the live map for this weekend{"'"}s exact stops.
          </p>
        </header>

        <section>
          <div style={sectionLabel}>Partner stops</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {SURF_BARS.map(bar => (
              <a
                key={bar.slug}
                href={`${cfg.basePath}/bars/${bar.slug}`}
                style={{ ...softCard, padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}
              >
                <span aria-hidden style={{ flex: '0 0 auto', width: 44, height: 44, borderRadius: 10,
                  border: `1px solid ${C.GOLD}`, background: 'rgba(212,163,51,0.12)', color: C.GOLD_HI,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900 }}>
                  {bar.name.slice(0, 1).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.INK, fontSize: 16, fontWeight: 800 }}>{bar.name}</div>
                  {bar.neighborhood && (
                    <div style={{ color: C.INK_DIM, fontSize: 12.5, marginTop: 2 }}>{bar.neighborhood}</div>
                  )}
                </div>
                <span aria-hidden style={{ color: C.GOLD, fontSize: 18, fontWeight: 800, flex: '0 0 auto' }}>→</span>
              </a>
            ))}
          </div>
        </section>

        <section style={{ ...softCard, padding: '22px 18px', textAlign: 'center' }}>
          <div style={{ color: C.INK, fontSize: 17, fontWeight: 800 }}>See the loop live</div>
          <div style={{ color: C.INK_DIM, fontSize: 13.5, margin: '6px 0 14px' }}>
            Watch where the shuttle is and which stop is next.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={cfg.trackPath} style={primaryCta}>See it live</a>
            <a href={cfg.basePath} style={ghostCta}>Back to {cfg.shortBrand}</a>
          </div>
        </section>

      </div>
    </main>
  )
}
