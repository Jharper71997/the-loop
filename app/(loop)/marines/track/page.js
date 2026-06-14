// The Loop — live tracking (Phase 1 scaffold, standalone military/transit style).
// Real-time map needs the Loop shuttle to broadcast GPS + a built route/schedule,
// which don't exist yet, so this shows schedule + status + a map placeholder.
// "Military-only" access will hard-gate once riders have logins; for now it's
// the military shuttle's own tracker, separate from the Brew Loop /track page.

export const metadata = {
  title: 'Live',
  description: 'See The Loop shuttle live. Camp Lejeune, Friday to Sunday, 9 to 5.',
  alternates: { canonical: '/marines/track' },
}
export const dynamic = 'force-dynamic'

const INK = '#eef1f3'
const INK_DIM = '#9aa3ab'
const OLIVE = '#8a9a4f'
const SAND = '#c8b88f'
const SURFACE = '#1a2027'
const LINE = 'rgba(255,255,255,0.10)'

export default function LoopTrackPage() {
  return (
    <main style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header>
          <div style={{ color: SAND, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>Live track</div>
          <h1 style={{ color: INK, fontSize: 22, fontWeight: 800, margin: '4px 0 0' }}>The Loop shuttle</h1>
        </header>

        {/* Status */}
        <section style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b727a', flex: '0 0 auto' }} />
          <div>
            <div style={{ color: INK, fontSize: 15, fontWeight: 700 }}>Not running right now</div>
            <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>Next service: Friday to Sunday, 9 to 5.</div>
          </div>
        </section>

        {/* Map placeholder */}
        <section style={{ ...card, overflow: 'hidden' }}>
          <div style={{ height: 280, display: 'grid', placeItems: 'center', textAlign: 'center',
            background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 12px, rgba(255,255,255,0.04) 12px 24px)' }}>
            <div style={{ display: 'grid', gap: 6, padding: 20 }}>
              <div style={{ color: OLIVE, fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Live map</div>
              <div style={{ color: INK_DIM, fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
                When The Loop is rolling, the shuttle shows here in real time with the next stop and arrival.
              </div>
            </div>
          </div>
        </section>

        <a href="/marines" style={{ ...ghost, textAlign: 'center' }}>Back to The Loop</a>
      </div>
    </main>
  )
}

const card = { borderRadius: 14, background: SURFACE, border: `1px solid ${LINE}` }
const ghost = { display: 'block', padding: '12px 18px', borderRadius: 999, background: 'transparent', color: INK, border: `1px solid ${LINE}`, fontWeight: 600, textDecoration: 'none', fontSize: 14 }
