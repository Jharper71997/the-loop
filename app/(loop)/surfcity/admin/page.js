// Surf City Loop console home. Code-gated (SurfAdminGate). Once unlocked, shows
// the active day's loops + quick links to the route Builder, Track, and Door.
// Deep analytics live on the Brew /leadership side and are intentionally out of
// scope here — the Surf console is for running the night + building the route.

import { isSurfAdmin } from '@/lib/surfAdmin'
import { getSurfLoopsForDay } from '@/lib/surfLoop'
import { C, card, eyebrow } from '../../_theme'
import SurfAdminGate from './SurfAdminGate'

export const dynamic = 'force-dynamic'

const fmtTime = t => (t ? t : '—')

export default async function SurfAdminHome() {
  if (!(await isSurfAdmin())) return <SurfAdminGate />

  const loops = await getSurfLoopsForDay()

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px', display: 'grid', gap: 18 }}>
      <div>
        <div style={eyebrow}>Surf City · Console</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800, color: C.INK, letterSpacing: '0.02em' }}>
          Run the loop
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <NavCard href="/surfcity/admin/builder" label="Route builder" sub="Build / edit loops" />
        <NavCard href="/surfcity/track" label="Live track" sub="Shuttle map" />
        <NavCard href="/surfcity/security" label="Door" sub="Check riders in" />
        <NavCard href="/surfcity/driver" label="Driver" sub="Manifest + GPS" />
      </div>

      <section style={{ ...card, padding: 16 }}>
        <div style={eyebrow}>Today&apos;s loops</div>
        {loops.length === 0 ? (
          <p style={{ color: C.INK_DIM, marginTop: 10, fontSize: 14 }}>
            No loops posted yet. Open the <a href="/surfcity/admin/builder" style={{ color: C.GOLD }}>route builder</a> to add one.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {loops.map(l => (
              <a key={l.groupId} href="/surfcity/admin/builder" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                textDecoration: 'none', color: C.INK, padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${C.LINE}`, background: C.SURFACE_HI,
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: C.INK_DIM }}>
                    {fmtTime(l.pickupTime)} · {l.stops.length} stop{l.stops.length === 1 ? '' : 's'} · {l.eventStatus || 'draft'}
                  </div>
                </div>
                <span style={{ color: C.GOLD, fontSize: 18 }}>→</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function NavCard({ href, label, sub }) {
  return (
    <a href={href} style={{
      ...card, padding: 14, textDecoration: 'none', color: C.INK, display: 'grid', gap: 2,
      background: C.SURFACE_HI,
    }}>
      <span style={{ fontWeight: 800, fontSize: 15 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.INK_DIM }}>{sub}</span>
    </a>
  )
}
