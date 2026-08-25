import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { currentStopIndex, nowInTZ, todayInTZ, formatStopTime } from '@/lib/schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/track/cohort — public, no PII.
// Returns per-stop rider counts for the active on-sale loop, polled by
// /track every 15s. Counts only — never names, phones, emails, ids.
//
// Shape:
//   { stops: [{ index, name, count, isCurrent, startTime }], total, lastUpdated }
//   { stops: [], total: 0 } when there's no active loop.
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }

  let admin
  try {
    admin = supabaseAdmin()
  } catch {
    return Response.json({ stops: [], total: 0 }, { headers })
  }

  const today = todayInTZ()

  const { data: eventRow } = await admin
    .from('events')
    .select('id, group_id, event_date, status')
    .eq('status', 'on_sale')
    .eq('kind', 'brew')   // Brew Loop /track cohort roll only
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!eventRow?.group_id) {
    return Response.json({ stops: [], total: 0 }, { headers })
  }

  const { data: groupRow } = await admin
    .from('groups')
    .select('id, schedule')
    .eq('id', eventRow.group_id)
    .maybeSingle()

  const schedule = Array.isArray(groupRow?.schedule) ? groupRow.schedule : []
  if (!schedule.length) {
    return Response.json({ stops: [], total: 0 }, { headers })
  }

  // Count only — never select identifying columns. If we ever want names
  // here, that needs a separate gated endpoint.
  const { data: members } = await admin
    .from('group_members')
    .select('current_stop_index')
    .eq('group_id', eventRow.group_id)

  const counts = new Array(schedule.length).fill(0)
  let total = 0
  for (const m of members || []) {
    const i = m?.current_stop_index
    if (Number.isInteger(i) && i >= 0 && i < schedule.length) {
      counts[i] += 1
      total += 1
    }
  }

  const currentIdx = currentStopIndex(schedule, nowInTZ(), eventRow.event_date, today)

  const stops = schedule.map((s, i) => ({
    index: i,
    name: s?.name || `Stop ${i + 1}`,
    count: counts[i],
    isCurrent: i === currentIdx,
    startTime: s?.start_time ? formatStopTime(s.start_time) : null,
  }))

  return Response.json({ stops, total, lastUpdated: new Date().toISOString() }, { headers })
}
