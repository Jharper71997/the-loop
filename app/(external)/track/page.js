import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { BARS, getBarByName } from '@/lib/bars'
import TrackMap from './TrackMap'

export const metadata = {
  title: 'Track the Loop',
  description: 'Live shuttle position for the Jville Brew Loop. See where the bus is, what bar is next, and meet every partner on the route.',
  alternates: { canonical: '/track' },
}
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

export default async function TrackPage() {
  const data = await loadActiveLoop()

  return (
    <main style={{ padding: '12px 12px 28px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ padding: '4px 4px 0' }}>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            Live track
          </div>
          <h1 style={{ color: INK, fontSize: 22, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.15 }}>
            {data.loopLabel || 'Brew Loop shuttle'}
          </h1>
          {data.subtitle && (
            <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>{data.subtitle}</div>
          )}
        </header>

        <TrackMap stops={data.stops} fallbackCenter={JACKSONVILLE_NC} />

        <PartnerBars />
      </div>
    </main>
  )
}

function PartnerBars() {
  return (
    <section
      style={{
        background: SURFACE,
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            On the route
          </div>
          <div style={{ color: INK, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            All {BARS.length} partner bars
          </div>
        </div>
        <span style={{ color: INK_DIM, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Route rotates
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: 'repeat(2, 1fr)',
          background: LINE,
        }}
      >
        {BARS.map(bar => <BarCell key={bar.slug} bar={bar} />)}
      </div>
    </section>
  )
}

function BarCell({ bar }) {
  return (
    <a
      href={`/bars/${bar.slug}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: SURFACE,
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden' }}>
        {bar.heroImage ? (
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,11,0) 40%, rgba(10,10,11,0.85)), url(${bar.heroImage}) center/cover` }} />
        ) : (
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(120% 80% at 50% 30%, rgba(212,163,51,0.18), transparent 70%), #0f0f12',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Image src="/brand/badge-gold.png" alt="" width={56} height={56} style={{ opacity: 0.4 }} />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: 10, right: 10, bottom: 8,
            color: INK,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {bar.name}
        </div>
      </div>
    </a>
  )
}

const JACKSONVILLE_NC = { lat: 34.7541, lng: -77.4302 }

async function loadActiveLoop() {
  let sb
  try { sb = supabaseAdmin() } catch { return { stops: [], loopLabel: null, subtitle: null } }

  const today = new Date().toISOString().slice(0, 10)

  // Mirror the public events feed: only show on-sale events to riders, then
  // pull the schedule off the linked group. This keeps the Track map in
  // sync with what the home/events pages call "the upcoming loop".
  const { data: eventRow } = await sb
    .from('events')
    .select('id, group_id, name, event_date, pickup_time, status')
    .eq('status', 'on_sale')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!eventRow) return { stops: [], loopLabel: null, subtitle: null }

  let group = null
  if (eventRow.group_id) {
    const { data: groupRow } = await sb
      .from('groups')
      .select('id, name, schedule')
      .eq('id', eventRow.group_id)
      .maybeSingle()
    group = groupRow
  }

  const schedule = Array.isArray(group?.schedule) ? group.schedule : []
  const stops = schedule.map((s, i) => {
    const bar = getBarByName(s?.name)
    return {
      index: i,
      name: s?.name || `Stop ${i + 1}`,
      startTime: s?.start_time || null,
      lat: bar?.lat ?? null,
      lng: bar?.lng ?? null,
    }
  })

  return {
    stops,
    loopLabel: eventRow.name || group?.name || 'Jville Brew Loop',
    subtitle: formatSubtitle(eventRow.event_date, eventRow.pickup_time),
  }
}

function formatSubtitle(date, pickup) {
  const d = formatDate(date)
  const t = formatTime(pickup)
  if (d && t) return `${d} · ${t} pickup`
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
