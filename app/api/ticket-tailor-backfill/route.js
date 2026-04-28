import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { handleOrder } from '@/lib/ticketTailor'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// TT backfill — split into two modes so a single event's orders can be
// processed inside Vercel's function timeout, while the UI can loop through
// many events for a full resync.
//
//   GET  /api/ticket-tailor-backfill            -> { event_ids: [...] }
//   POST /api/ticket-tailor-backfill            -> backfill ALL events (may 504)
//   POST /api/ticket-tailor-backfill?event_id=X -> backfill just that event
//
// Idempotent via orders.metadata->>tt_order_id + contact natural keys.

export async function GET() {
  const denied = await denyIfNotLeadership()
  if (denied) return denied
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('groups')
    .select('tt_event_id')
    .not('tt_event_id', 'is', null)
  if (error) return Response.json({ error: 'groups_query_failed' }, { status: 500 })
  const eventIds = Array.from(new Set((data || []).map(g => g.tt_event_id).filter(Boolean)))
  return Response.json({ event_ids: eventIds })
}

export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'TICKET_TAILOR_API_KEY not set on this environment' },
      { status: 500 }
    )
  }
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
  const supabase = supabaseAdmin()

  const { searchParams } = new URL(req.url)
  const singleEventId = searchParams.get('event_id')

  let eventIds
  if (singleEventId) {
    eventIds = [singleEventId]
  } else {
    const { data, error } = await supabase
      .from('groups')
      .select('tt_event_id')
      .not('tt_event_id', 'is', null)
    if (error) return Response.json({ error: `groups query: ${error.message}` }, { status: 500 })
    eventIds = Array.from(new Set((data || []).map(g => g.tt_event_id).filter(Boolean)))
  }

  if (eventIds.length === 0) {
    return Response.json({
      ok: true,
      events_processed: 0,
      total_orders: 0,
      replayed: 0,
      errors: 0,
      per_event: [],
      warning: 'No groups in the DB have a tt_event_id yet. The TT webhook needs to fire at least once (from a real sale) before there is anything to backfill.',
    })
  }

  const perEvent = []
  let totalOrders = 0
  let totalReplayed = 0
  let totalErrors = 0

  for (const eventId of eventIds) {
    const fetchResult = await fetchAllOrdersForEvent(eventId, auth)
    if (fetchResult.error) {
      perEvent.push({
        event_id: eventId,
        orders: 0,
        replayed: 0,
        errors: 1,
        api_status: fetchResult.status,
        api_error: fetchResult.error,
      })
      totalErrors++
      continue
    }
    const orders = fetchResult.orders
    totalOrders += orders.length
    let replayed = 0
    let errors = 0
    const handlerErrors = []
    for (const o of orders) {
      try {
        // Backfills mint QRs but skip the SMS — these orders predate the new
        // /tickets/<code> link and the buyer doesn't need a fresh confirmation
        // text. QRs still mint so security can scan tickets at the door.
        await handleOrder(supabase, o, { skipSms: true })
        replayed++
      } catch (err) {
        errors++
        handlerErrors.push({ order_id: o.id, error: err?.message || String(err) })
      }
    }
    totalReplayed += replayed
    totalErrors += errors
    perEvent.push({
      event_id: eventId,
      orders: orders.length,
      replayed,
      errors,
      handler_errors: handlerErrors.length ? handlerErrors : undefined,
    })
  }

  return Response.json({
    ok: true,
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
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://api.tickettailor.com/v1/orders')
    url.searchParams.set('event_id', eventId)
    url.searchParams.set('limit', '100')
    if (startingAfter) url.searchParams.set('starting_after', startingAfter)

    let res
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: auth, Accept: 'application/json' },
      })
    } catch (err) {
      return { error: `fetch failed: ${err?.message || err}`, status: null, orders: all }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        error: `TT API ${res.status}: ${text.slice(0, 300) || res.statusText}`,
        status: res.status,
        orders: all,
      }
    }

    let data
    try {
      data = await res.json()
    } catch {
      return { error: `TT API returned non-JSON`, status: res.status, orders: all }
    }

    const batch = Array.isArray(data?.data) ? data.data : []
    if (!batch.length) break
    all.push(...batch)
    if (!data.links?.next) break
    startingAfter = batch[batch.length - 1]?.id
    if (!startingAfter) break
  }
  return { orders: all }
}
