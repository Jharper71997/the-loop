import { supabaseAdmin } from './supabaseAdmin'
import { lookupBarsByNames } from './barsServer'
import { operationalDateInTZ } from './schedule'
import { brandFor } from './businessConfig'

// Shared loader for the rider /track page, scoped to a business (Brew/Surf).
// Mirrors the public events feed: only on-sale events, then the linked group's
// schedule resolved to map pins. Returns { stops, loopLabel, subtitle, eventDate }.
export async function loadActiveTrackLoop(business = 'brew') {
  let sb
  try { sb = supabaseAdmin() } catch { return { stops: [], loopLabel: null, subtitle: null } }

  // Eastern operational date: keeps tonight's loop visible until the next
  // morning instead of rolling over at UTC midnight mid-shift.
  const today = operationalDateInTZ()

  const { data: eventRow } = await sb
    .from('events')
    .select('id, group_id, name, event_date, pickup_time, status')
    .eq('status', 'on_sale')
    .eq('kind', business)   // scope to the active business; Marines tracks at /marines/track
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
  const barLookup = await lookupBarsByNames(sb, schedule.map(s => s?.name).filter(Boolean), { business })
  const stops = schedule.map((s, i) => {
    const bar = s?.name ? barLookup.get(s.name) : null
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
    loopLabel: eventRow.name || group?.name || brandFor(business).brand,
    subtitle: formatSubtitle(eventRow.event_date, eventRow.pickup_time),
    eventDate: eventRow.event_date || null,
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
