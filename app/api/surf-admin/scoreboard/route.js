import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isSurfAdmin } from '@/lib/surfAdmin'
import { getActiveSurfLoop } from '@/lib/surfLoop'
import { currentStopIndex, nowInTZ, operationalDateInTZ } from '@/lib/schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/surf-admin/scoreboard — code-gated. Surf City Loop leadership
// scoreboard. Mirrors /api/loop-admin/scoreboard but for kind='surf':
//   - live: the active loop right now (on board, collected, current/next stop)
//   - weekend: riders + revenue tied to the active group's event(s)
//   - cumulative: all-time Surf City
//
// "riders/single/day" = paid order_items joined to ticket_types (Single Ride /
// Day Pass). Revenue uses metadata.amount_collected_cents (fallback total_cents)
// so a $0 comp doesn't inflate dollars — same rule as /api/surf-admin/revenue.

const isDay = name => /day\s*pass/i.test(String(name || ''))
const isSingle = name => /single/i.test(String(name || ''))

function collected(o) {
  return Number.isInteger(o?.metadata?.amount_collected_cents)
    ? o.metadata.amount_collected_cents
    : (o?.total_cents || 0)
}

// Tally Single/Day/total + revenue over a set of paid surf orders.
async function tally(sb, orders) {
  const orderIds = (orders || []).map(o => o.id)
  let single = 0, day = 0, riders = 0
  if (orderIds.length) {
    const { data: items } = await sb
      .from('order_items')
      .select('id, ticket_type:ticket_types(name)')
      .in('order_id', orderIds)
      .is('voided_at', null)
    for (const it of items || []) {
      const name = it.ticket_type?.name
      if (isDay(name)) day++
      else if (isSingle(name)) single++
      riders++
    }
  }
  let revenueCents = 0
  for (const o of orders || []) revenueCents += collected(o)
  return { riders, single, day, revenueCents }
}

export async function GET() {
  if (!(await isSurfAdmin())) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const sb = supabaseAdmin()

  let loop = null
  try { loop = await getActiveSurfLoop() } catch {}

  // --- cumulative: all-time paid surf orders ---
  const { data: allOrders } = await sb
    .from('orders')
    .select('id, total_cents, metadata, event_id')
    .eq('status', 'paid')
    .eq('metadata->>kind', 'surf')
    .is('refunded_at', null)
  const cumulative = await tally(sb, allOrders || [])

  // No active loop: still return cumulative so the page renders something.
  if (!loop?.groupId) {
    return Response.json({
      live: null,
      weekend: { riders: 0, revenueCents: 0, single: 0, day: 0 },
      cumulative,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // The active loop's events, to scope "weekend".
  const { data: events } = await sb.from('events').select('id').eq('group_id', loop.groupId)
  const eventIds = (events || []).map(e => e.id)
  const eventIdSet = new Set(eventIds)

  // Weekend = paid surf orders on the active group's event(s).
  const weekendOrders = (allOrders || []).filter(o => o.event_id && eventIdSet.has(o.event_id))
  const weekend = await tally(sb, weekendOrders)

  // --- live: on board now + current/next stop from the schedule ---
  const stops = Array.isArray(loop.stops) ? loop.stops : []
  const schedule = stops.map(s => ({ name: s.name, start_time: s.startTime }))
  const today = operationalDateInTZ()
  const now = nowInTZ()
  const idx = currentStopIndex(schedule, now, loop.eventDate, today)

  let currentStopName = null, nextStopName = null
  if (idx != null && idx >= 0 && idx < stops.length) {
    currentStopName = stops[idx]?.name || null
    nextStopName = stops[idx + 1]?.name || null
  } else if (idx != null && idx < 0) {
    // Pre-pickup: next stop is the first one.
    nextStopName = stops[0]?.name || null
  }

  // On board now = order_items whose latest loop_boardings action is 'board'.
  let onBoardNow = 0
  const { data: boardings } = await sb
    .from('loop_boardings')
    .select('order_item_id, action, created_at')
    .eq('group_id', loop.groupId)
    .order('created_at', { ascending: true })
  const lastByItem = new Map()
  for (const b of boardings || []) {
    if (b.order_item_id) lastByItem.set(b.order_item_id, b)
  }
  for (const b of lastByItem.values()) {
    if (b.action === 'board') onBoardNow++
  }

  return Response.json({
    live: {
      groupId: loop.groupId,
      name: loop.name,
      eventDate: loop.eventDate,
      onBoardNow,
      revenueCents: weekend.revenueCents,
      single: weekend.single,
      day: weekend.day,
      currentStopName,
      nextStopName,
      currentStopIndex: (idx != null && idx >= 0 && idx < stops.length) ? idx : null,
      stopCount: stops.length,
    },
    weekend,
    cumulative,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
