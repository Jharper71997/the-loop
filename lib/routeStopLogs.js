// Slot generation + helpers for route_stop_logs (migration 026).
//
// generateStopsForEvent reads the event's group schedule (one cycle) and
// fans it out × N cycles to seed 25 rows. Idempotent — re-running after a
// schedule edit refreshes bar names + scheduled times only on rows the
// driver hasn't filled (actual_arrival_at is null).

import { lookupBarsByNames } from './barsServer'

const TZ = 'America/Indiana/Indianapolis'
const DEFAULT_CYCLES = 5
const DEFAULT_BARS_PER_CYCLE = 5
const CYCLE_MINUTES = 75

export async function generateStopsForEvent(supabase, eventId, opts = {}) {
  if (!eventId) return { error: 'event_id_required', generated: 0, total: 0 }

  const cycles = Number.isFinite(opts.cycles) ? opts.cycles : DEFAULT_CYCLES
  const barsPerCycle = Number.isFinite(opts.barsPerCycle) ? opts.barsPerCycle : DEFAULT_BARS_PER_CYCLE

  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, event_date, pickup_time, group_id, groups(schedule)')
    .eq('id', eventId)
    .maybeSingle()
  if (evErr) return { error: evErr.message, generated: 0, total: 0 }
  if (!event) return { error: 'event_not_found', generated: 0, total: 0 }
  if (!event.event_date) return { error: 'event_date_missing', generated: 0, total: 0 }

  const schedRaw = Array.isArray(event.groups?.schedule) ? event.groups.schedule : []
  // Keep every named bar in the schedule. Earlier we required start_time too,
  // but syncScheduleFromTicketTypes only fills start_time for stop 0 — every
  // other bar comes through with an empty string, which silently dropped them
  // and made generate produce 1 bar × 5 cycles.
  const named = schedRaw
    .slice(0, barsPerCycle)
    .filter(s => s && s.name)
  if (!named.length) {
    return { error: 'schedule_missing', generated: 0, total: 0, eventId }
  }

  // Pick a base wall-clock time for stop 0 — the event's pickup_time, or the
  // first non-empty start_time in the schedule, or 18:30 as a last resort.
  const firstSchedStart = named.find(s => s.start_time)?.start_time
  const baseStart = event.pickup_time || firstSchedStart || '18:30'
  const perStopMin = Math.max(1, Math.floor(CYCLE_MINUTES / named.length))

  // Fill in synthesized start_times so every bar gets evenly spaced across a
  // 75-min cycle. Explicit start_times in the schedule still win.
  const cycle1 = named.map((s, i) => ({
    name: s.name,
    start_time: s.start_time || addMinutes(baseStart, i * perStopMin),
  }))

  const barLookup = await lookupBarsByNames(supabase, cycle1.map(s => s.name)).catch(() => new Map())

  const rows = []
  for (let c = 1; c <= cycles; c++) {
    const cycleOffset = (c - 1) * CYCLE_MINUTES
    for (let p = 0; p < cycle1.length; p++) {
      const entry = cycle1[p]
      const stopIndex = (c - 1) * cycle1.length + (p + 1)
      const scheduledAt = makeTzTimestamp(event.event_date, entry.start_time, cycleOffset)
      if (!scheduledAt) continue
      rows.push({
        event_id: eventId,
        stop_index: stopIndex,
        cycle_index: c,
        bar_position: p + 1,
        bar_name: entry.name,
        bar_slug: barLookup.get(entry.name)?.slug ?? null,
        scheduled_at: scheduledAt,
      })
    }
  }

  if (!rows.length) return { error: 'no_rows_built', generated: 0, total: 0, eventId }

  // Two-step idempotent upsert. Insert new rows; for conflicts, only refresh
  // the schedule-derived columns when the driver hasn't filled the row.
  const { data: existing } = await supabase
    .from('route_stop_logs')
    .select('stop_index, actual_arrival_at')
    .eq('event_id', eventId)
  const lockedIndexes = new Set(
    (existing || [])
      .filter(r => r.actual_arrival_at != null)
      .map(r => r.stop_index)
  )

  const writable = rows.filter(r => !lockedIndexes.has(r.stop_index))
  const now = new Date().toISOString()
  const writableWithMeta = writable.map(r => ({ ...r, updated_at: now }))

  const { error: upErr } = await supabase
    .from('route_stop_logs')
    .upsert(writableWithMeta, { onConflict: 'event_id,stop_index' })
  if (upErr) return { error: upErr.message, generated: 0, total: rows.length, eventId }

  return {
    eventId,
    generated: writable.length,
    locked: lockedIndexes.size,
    total: rows.length,
  }
}

export function deriveDelayMinutes(scheduledAt, actualArrivalAt) {
  if (!scheduledAt || !actualArrivalAt) return null
  const s = new Date(scheduledAt).getTime()
  const a = new Date(actualArrivalAt).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(a)) return null
  return Math.round((a - s) / 60000)
}

// "HH:MM" + N minutes → "HH:MM" wall clock, wrapping past midnight.
function addMinutes(hhmm, plusMin) {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const total = (h * 60 + m + plusMin) % (24 * 60)
  const finalH = Math.floor(total / 60)
  const finalM = total % 60
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
}

// Build an ISO timestamp string for `eventDateIso (YYYY-MM-DD) at baseHHMM
// + plusMinutes` interpreted as a wall time in TZ. Handles cross-midnight
// rollover and DST transitions correctly via Intl.DateTimeFormat.
function makeTzTimestamp(eventDateIso, baseHHMM, plusMinutes) {
  if (!eventDateIso || !baseHHMM) return null
  const [yyyy, mm, dd] = eventDateIso.split('-').map(Number)
  const [h0, m0] = String(baseHHMM).split(':').map(Number)
  if (!Number.isFinite(yyyy) || !Number.isFinite(h0) || !Number.isFinite(m0)) return null

  const totalMin = h0 * 60 + m0 + plusMinutes
  const dayOffset = Math.floor(totalMin / 1440)
  const minInDay = ((totalMin % 1440) + 1440) % 1440
  const finalH = Math.floor(minInDay / 60)
  const finalM = minInDay % 60

  const baseDate = new Date(Date.UTC(yyyy, mm - 1, dd))
  baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset)
  const finalY = baseDate.getUTCFullYear()
  const finalMo = baseDate.getUTCMonth() + 1
  const finalD = baseDate.getUTCDate()

  // Trick: pretend the wall-clock numbers are UTC, then ask "what does that
  // moment look like in TZ?" The difference is the offset for that wall time.
  // True UTC = wallAsUTC − offset.
  const wallAsUTC = Date.UTC(finalY, finalMo - 1, finalD, finalH, finalM, 0)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(wallAsUTC))
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, Number(p.value)])
  )
  const hourPart = parts.hour === 24 ? 0 : parts.hour
  const tzAsUTC = Date.UTC(parts.year, parts.month - 1, parts.day, hourPart, parts.minute, parts.second)
  const offsetMs = tzAsUTC - wallAsUTC
  const trueUTC = wallAsUTC - offsetMs
  return new Date(trueUTC).toISOString()
}
