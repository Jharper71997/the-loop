import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getBarByName } from '@/lib/bars'
import TrackMap from './TrackMap'

export const metadata = {
  title: 'Track the Loop',
  description: 'Live shuttle position for the Jville Brew Loop. Tap to see where the bus is and what bar is next.',
  alternates: { canonical: '/track' },
}
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default async function TrackPage() {
  const data = await loadActiveLoop()

  return (
    <main style={{ padding: '12px 12px 28px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 12 }}>
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
      </div>
    </main>
  )
}

const JACKSONVILLE_NC = { lat: 34.7541, lng: -77.4302 }

async function loadActiveLoop() {
  let sb
  try { sb = supabaseAdmin() } catch { return { stops: [], loopLabel: null, subtitle: null } }

  const today = new Date().toISOString().slice(0, 10)

  const { data: groupRows } = await sb
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)

  const group = groupRows?.[0]
  if (!group) return { stops: [], loopLabel: null, subtitle: null }

  const schedule = Array.isArray(group.schedule) ? group.schedule : []
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
    loopLabel: group.name || 'Jville Brew Loop',
    subtitle: formatSubtitle(group.event_date, group.pickup_time),
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
