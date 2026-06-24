// Surf City Loop driver surface. Code-gated (Surf driver OR Surf admin). Shows
// today's loops + their stop order, and links to the live map. Full GPS
// broadcasting + per-rider manifest is a planned follow-up (the Brew /admin
// driver tools cover the shared shuttle in the meantime).

import { isSurfDriver } from '@/lib/surfDriver'
import { isSurfAdmin } from '@/lib/surfAdmin'
import { getSurfLoopsForDay } from '@/lib/surfLoop'
import { C, card, eyebrow, primaryCta } from '../../_theme'
import SurfDriverGate from './SurfDriverGate'

export const dynamic = 'force-dynamic'

export default async function SurfDriverPage() {
  const [driver, admin] = await Promise.all([isSurfDriver(), isSurfAdmin()])
  if (!driver && !admin) return <SurfDriverGate />

  const loops = await getSurfLoopsForDay()

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px', display: 'grid', gap: 16 }}>
      <div>
        <div style={eyebrow}>Surf City · Driver</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: C.INK }}>Today&apos;s route</h1>
      </div>

      <a href="/surfcity/track" style={{ ...primaryCta, textAlign: 'center' }}>Open live map</a>

      {loops.length === 0 && <p style={{ color: C.INK_DIM }}>No loops posted for today.</p>}

      {loops.map(l => (
        <section key={l.groupId} style={{ ...card, padding: 16 }}>
          <div style={{ fontWeight: 800, color: C.INK }}>{l.name}</div>
          <div style={{ fontSize: 12, color: C.INK_DIM, marginBottom: 10 }}>
            {l.pickupTime || '—'} · {l.eventStatus}
          </div>
          <ol style={{ margin: 0, padding: '0 0 0 18px', color: C.INK, fontSize: 15, lineHeight: 1.8 }}>
            {l.stops.map((s, i) => (
              <li key={i}>{s.name}{s.startTime ? ` · ${s.startTime}` : ''}</li>
            ))}
          </ol>
        </section>
      ))}

      <p style={{ color: C.INK_DIM, fontSize: 12.5, lineHeight: 1.5 }}>
        Live GPS broadcasting from this screen is coming soon. For now, riders watch the route + stops on the live map.
      </p>
    </main>
  )
}
