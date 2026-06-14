// Standalone shell for "The Loop" — the Camp Lejeune shuttle. Deliberately
// NOT inside the (external) Brew Loop layout: no Brew Loop top bar / tab bar /
// branding, because under-21 riders are on this shuttle and it must not read
// as a bar-hop service. Military / transit look, its own metadata.

export const metadata = {
  title: { default: 'The Loop', template: '%s · The Loop' },
  description: 'The Loop is a hop-on, hop-off shuttle for Camp Lejeune. Ride to local spots all weekend, Friday to Sunday, 9 to 5.',
  openGraph: {
    type: 'website',
    siteName: 'The Loop',
    title: 'The Loop — Camp Lejeune shuttle',
    description: 'Hop on, hop off to local spots all weekend. Camp Lejeune, Friday to Sunday. Military only.',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: 'The Loop — Camp Lejeune shuttle' },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14181c',
}

const BG = '#14181c'
const INK = '#eef1f3'
const OLIVE = '#8a9a4f'
const SAND = '#c8b88f'
const LINE = 'rgba(255,255,255,0.10)'

export default function LoopLayout({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, color: INK, WebkitFontSmoothing: 'antialiased',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* transit-style top banner */}
      <div aria-hidden style={{ height: 4, background: `linear-gradient(90deg, ${OLIVE}, ${SAND})` }} />
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(20,24,28,0.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${LINE}`,
        paddingTop: 'env(safe-area-inset-top)' }}>
        <nav style={{ maxWidth: 760, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
          <a href="/marines" aria-label="The Loop home" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${OLIVE}`, color: OLIVE,
              fontSize: 13, fontWeight: 900, letterSpacing: '0.02em', background: 'rgba(138,154,79,0.14)' }}>
              TL
            </span>
            <span style={{ display: 'grid', lineHeight: 1.05 }}>
              <span style={{ color: INK, fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>The Loop</span>
              <span style={{ color: SAND, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Camp Lejeune Shuttle</span>
            </span>
          </a>
        </nav>
      </header>
      {children}
    </div>
  )
}
