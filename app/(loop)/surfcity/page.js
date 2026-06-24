// Surf City Loop — rider-facing landing.
// A weekend bar-hop shuttle on Topsail Island. Ride with friends, hop on and
// off across the day's loops, skip the drive. Standalone Surf City identity,
// NOT Brew Loop branded — and NO Marines ID/verify gate (Surf has no
// verification). Surf runs MULTIPLE loops per day, so the "today" section lists
// every active loop (name + first pickup + stops) from getSurfLoopsForDay().

import { brandFor } from '@/lib/businessConfig'
import { getSurfLoopsForDay } from '@/lib/surfLoop'
import { C, card, eyebrow, sectionLabel, primaryCta, ghostCta } from '../_theme'

const cfg = brandFor('surf')

export const metadata = {
  title: { absolute: 'Surf City Loop — ride with friends' },
  description: 'A weekend bar-hop shuttle on Topsail Island. One ride, every stop, all weekend. No driving.',
  alternates: { canonical: cfg.basePath },
}

export const dynamic = 'force-dynamic'

const BG_GLOW = 'radial-gradient(120% 80% at 50% 0%, rgba(212,163,51,0.20), transparent 60%), #121216'

const STEPS = [
  ['Grab your spot', 'Book a seat online in under a minute. No app to download.'],
  ['Meet the shuttle', 'Catch the Loop at the first stop on the route for the loop you picked.'],
  ['Ride with friends', 'Hop on and off across the stops all day. The shuttle is shared, so you ride with everyone out that day.'],
  ['Skip the drive', 'We handle the driving so you and your friends do not have to.'],
]

export default async function SurfcityLanding() {
  let loops = []
  try { loops = await getSurfLoopsForDay() } catch {}

  return (
    <main className="external-shell" style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>

        {/* Hero */}
        <section style={{ ...card, borderRadius: 18, position: 'relative', overflow: 'hidden', padding: '28px 22px 24px', background: BG_GLOW, border: `1px solid ${C.LINE}`, boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
          <div aria-hidden style={{ position: 'absolute', right: -40, bottom: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(212,163,51,0.18), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.GOLD, boxShadow: `0 0 10px ${C.GOLD}`, display: 'inline-block' }} />
            {cfg.shortBrand} · Topsail Island
          </div>
          <h1 style={{ position: 'relative', color: C.INK, fontSize: 32, fontWeight: 800, margin: '10px 0 8px', letterSpacing: '-0.015em', lineHeight: 1.06 }}>
            Ride with friends. Skip the drive.
          </h1>
          <p style={{ position: 'relative', color: C.INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
            {cfg.brand} is a shared weekend shuttle that loops the best spots on Topsail Island.
            Hop on at the first stop and ride with friends across the route. No car needed.
          </p>
          <div style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <a href={`${cfg.basePath}/buy`} style={primaryCta}>Get a ride</a>
            <a href={cfg.trackPath} style={ghostCta}>See it live</a>
          </div>
        </section>

        {/* This weekend's loops — Surf runs multiple loops per day. */}
        <section>
          <div style={sectionLabel}>This weekend</div>
          {loops.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {loops.map(loop => (
                <div key={loop.groupId} style={{ ...softCard, padding: '16px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ color: C.INK, fontSize: 16, fontWeight: 800 }}>{loop.name}</div>
                    <div style={{ color: C.GOLD_HI, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatSubtitle(loop.eventDate, loop.pickupTime)}
                    </div>
                  </div>
                  {loop.stops?.length > 0 && (
                    <ol style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
                      {loop.stops.map(s => (
                        <li key={s.index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={stepNumSm}>{s.index + 1}</span>
                          <span style={{ color: C.INK_DIM, fontSize: 13.5 }}>
                            {s.name}{s.startTime ? ` · ${formatTime(s.startTime)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...softCard, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b727a', flex: '0 0 auto' }} />
              <div>
                <div style={{ color: C.INK, fontSize: 15, fontWeight: 700 }}>No loops posted yet</div>
                <div style={{ color: C.INK_DIM, fontSize: 13, marginTop: 2 }}>Check back soon — this weekend{"'"}s loops show up here once they{"'"}re set.</div>
              </div>
            </div>
          )}
        </section>

        {/* How it works */}
        <section>
          <div style={sectionLabel}>How it works</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {STEPS.map(([title, body], i) => (
              <div key={title} style={{ ...softCard, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={stepNum}>{i + 1}</span>
                <div>
                  <div style={{ color: C.INK, fontSize: 15, fontWeight: 700 }}>{title}</div>
                  <div style={{ color: C.INK_DIM, fontSize: 13.5, marginTop: 2, lineHeight: 1.45 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Route */}
        <section style={{ ...softCard, padding: '16px 16px' }}>
          <div style={sectionLabel}>The route</div>
          <p style={{ color: C.INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            The Loop runs a set route of stops across Topsail Island, and the route can change
            weekend to weekend. Check the live map for where the shuttle is right now, or see our partner
            stops below.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <a href={cfg.trackPath} style={ghostCta}>See it live</a>
            <a href={`${cfg.basePath}/bars`} style={ghostCta}>Partner stops</a>
          </div>
        </section>

        <section style={{ ...softCard, padding: '22px 18px', textAlign: 'center', background: BG_GLOW }}>
          <div style={{ color: C.INK, fontSize: 17, fontWeight: 800 }}>Ready to ride?</div>
          <div style={{ color: C.INK_DIM, fontSize: 13.5, margin: '6px 0 14px' }}>
            Grab a seat and we{"'"}ll handle the driving.
          </div>
          <a href={`${cfg.basePath}/buy`} style={primaryCta}>Get a ride</a>
        </section>

      </div>
    </main>
  )
}

function formatSubtitle(date, pickup) {
  const d = formatDate(date)
  const t = formatTime(pickup)
  if (d && t) return `${d} · ${t}`
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

const softCard = { ...card, borderRadius: 16, boxShadow: '0 14px 30px rgba(0,0,0,0.22)' }
const stepNum = { flex: '0 0 auto', width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.GOLD}`, color: C.GOLD_HI, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const stepNumSm = { flex: '0 0 auto', width: 22, height: 22, borderRadius: '50%', background: 'rgba(212,163,51,0.12)', border: `1px solid rgba(212,163,51,0.4)`, color: C.GOLD_HI, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
