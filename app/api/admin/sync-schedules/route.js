import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/sync-schedules
// Walks every event with a group_id and rebuilds groups.schedule from the
// event's active ticket_types — name comes from each ticket type, start_time
// is preserved from the existing schedule entry where present.
//
// Use this once after deploying the auto-sync code so existing Loops with
// pre-existing "Stop 2/3/4/5" placeholders catch up to their real bar names.
// Idempotent — safe to run repeatedly.
export async function POST() {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const supabase = supabaseAdmin()

  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, group_id, pickup_time')
    .not('group_id', 'is', null)
  if (evErr) return Response.json({ error: evErr.message }, { status: 500 })

  let synced = 0
  let skipped = 0
  for (const ev of events || []) {
    const result = await syncOne(supabase, ev)
    if (result.synced) synced++
    else skipped++
  }

  return Response.json({ ok: true, synced, skipped, total: (events || []).length })
}

async function syncOne(supabase, ev) {
  const { data: tts } = await supabase
    .from('ticket_types')
    .select('name, stop_index')
    .eq('event_id', ev.id)
    .eq('active', true)

  const stopMap = new Map()
  for (const tt of tts || []) {
    if (tt.stop_index == null || tt.stop_index < 0) continue
    if (!stopMap.has(tt.stop_index)) stopMap.set(tt.stop_index, tt.name)
  }
  if (stopMap.size === 0) return { synced: false }

  const { data: g } = await supabase
    .from('groups')
    .select('schedule')
    .eq('id', ev.group_id)
    .maybeSingle()
  const existing = Array.isArray(g?.schedule) ? g.schedule : []

  const maxIdx = Math.max(...stopMap.keys(), existing.length - 1)
  const next = []
  for (let i = 0; i <= maxIdx; i++) {
    const ttName = stopMap.get(i)
    const prior = existing[i] || {}
    const start = prior.start_time || (i === 0 ? ev.pickup_time : '') || ''
    next.push({
      name: ttName || prior.name || `Stop ${i + 1}`,
      start_time: start,
    })
  }

  await supabase.from('groups').update({ schedule: next }).eq('id', ev.group_id)
  return { synced: true }
}
