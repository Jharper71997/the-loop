// The Loop — live tracking. Mirrors the Brew Loop (external)/track page but for
// the active Marines loop: loads the kind='marines' group, reads its inline-coord
// stops, and renders the loop live map (LoopTrackMap polls /api/shuttle/current
// scoped to this group_id, so it never shows the Brew Loop bus).

import { getActiveMarinesLoop } from '@/lib/marinesLoop'
import LoopTrackMap from './LoopTrackMap'
import { C, card, ghostCta } from '../../_theme'

export const metadata = {
  title: 'Live',
  description: 'See The Loop shuttle live — where it is on the loop and which stop is next.',
  alternates: { canonical: '/marines/track' },
}
export const dynamic = 'force-dynamic'

// Camp Lejeune area — map center when no stops have coords yet.
const FALLBACK_CENTER = { lat: 34.7541, lng: -77.4302 }

export default async function LoopTrackPage() {
  let loop = null
  try { loop = await getActiveMarinesLoop() } catch {}

  const stops = loop?.stops || []

  return (
    <main className="external-shell" style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ padding: '4px 4px 0' }}>
          <div style={{ color: C.GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.GOLD, boxShadow: `0 0 10px ${C.GOLD}`, display: 'inline-block' }} />
            Live track
          </div>
          <h1 style={{ color: C.INK, fontSize: 26, fontWeight: 800, margin: '6px 0 0', lineHeight: 1.1, letterSpacing: '-0.015em' }}>
            {loop?.name || 'The Loop shuttle'}
          </h1>
          {loop && (
            <div style={{ color: C.INK_DIM, fontSize: 13, marginTop: 2 }}>
              {formatSubtitle(loop.eventDate, loop.pickupTime)}
            </div>
          )}
        </header>

        {loop ? (
          <LoopTrackMap
            stops={stops}
            eventDate={loop.eventDate}
            groupId={loop.groupId}
            fallbackCenter={FALLBACK_CENTER}
          />
        ) : (
          <section style={{ ...card, borderRadius: 16, boxShadow: '0 16px 34px rgba(0,0,0,0.26)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b727a', flex: '0 0 auto' }} />
            <div>
              <div style={{ color: C.INK, fontSize: 15, fontWeight: 700 }}>Not running right now</div>
              <div style={{ color: C.INK_DIM, fontSize: 13, marginTop: 2 }}>Check back this weekend — the loop shows here when the shuttle is rolling.</div>
            </div>
          </section>
        )}

        <a href="/marines" style={{ ...ghostCta, display: 'block', textAlign: 'center' }}>Back to The Loop</a>
      </div>
    </main>
  )
}

function formatSubtitle(date, pickup) {
  const d = formatDate(date)
  const t = formatTime(pickup)
  if (d && t) return `${d} · ${t} first pickup`
  return d || t || ''
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
