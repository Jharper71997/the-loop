import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { handleOrder } from '@/lib/ticketTailor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/ticket-tailor-backfill
//
// Re-pulls every TT order for every group that was ever synced with a
// tt_event_id and re-runs it through the webhook handler. Safe to call
// repeatedly — handleOrder is idempotent (contacts and group_members are
// keyed by natural keys; the synthetic `orders` row dedupes on
// metadata.tt_order_id).
//
// Use this after wiring the TT webhook to populate `orders` for TT sales
// that arrived before the webhook did the mirroring (or to reconcile after
// any webhook delivery failures).
//
// Requires TICKET_TAILOR_API_KEY. No body required.
export async function POST() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'TICKET_TAILOR_API_KEY not set' }, { status: 500 })
  }
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
  const supabase = supabaseAdmin()

  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('id, tt_event_id, name, event_date')
    .not('tt_event_id', 'is', null)
  if (gErr) return Response.json({ error: gErr.message }, { status: 500 })

  const eventIds = Array.from(new Set((groups || []).map(g => g.tt_event_id).filter(Boolean)))

  const perEvent = []
  let totalOrders = 0
  let totalReplayed = 0
  let totalErrors = 0

  for (const eventId of eventIds) {
    const orders = await fetchAllOrdersForEvent(eventId, auth)
    totalOrders += orders.length
    let replayed = 0
    let errors = 0
    for (const o of orders) {
      try {
        await handleOrder(supabase, o)
        replayed++
      } catch (err) {
        console.error(`[tt-backfill] event ${eventId} order ${o.id} failed`, err)
        errors++
      }
    }
    totalReplayed += replayed
    totalErrors += errors
    perEvent.push({ event_id: eventId, orders: orders.length, replayed, errors })
  }

  return Response.json({
    events_processed: eventIds.length,
    total_orders: totalOrders,
    replayed: totalReplayed,
    errors: totalErrors,
    per_event: perEvent,
  })
}

async function fetchAllOrdersForEvent(eventId, auth) {
  const all = []
  let startingAfter = null
  // TT paginates with ?starting_after. Cap at 10 pages (~1000 orders) as a
  // safety stop — way above anything Brew Loop realistically sells per event.
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://api.tickettailor.com/v1/orders')
    url.searchParams.set('event_id', eventId)
    url.searchParams.set('limit', '100')
    if (startingAfter) url.searchParams.set('starting_after', startingAfter)
    const res = await fetch(url.toString(), {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (!res.ok) break
    const data = await res.json()
    const batch = Array.isArray(data?.data) ? data.data : []
    if (!batch.length) break
    all.push(...batch)
    if (!data.links?.next) break
    startingAfter = batch[batch.length - 1]?.id
    if (!startingAfter) break
  }
  return all
}
