import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotAdmin } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/loop-tickets
// Paid-ticket aggregates for the /admin/groups (Loops) page. That page runs
// client-side with the anon key, and RLS hides `orders` from anon — so its own
// party_size query came back empty and every rider count silently fell back to
// the number of contact rows (a 4-ticket group buy showed as "1 rider"). We
// aggregate here with the service key and return only counts, so orders stay
// private. Staff-gated.
//
// Returns:
//   ticketsByGroup { [groupId]: totalPaidTickets }   // sum of party_size
//   seatsByContact { [contactId]: seats }            // from order_items, with
//     a group buy's unnamed seats credited to the buyer contact — so per-stop
//     sums match the group total without double-counting a named companion who
//     already has their own rider row.
//   groupHasEvent  { [groupId]: true }
export async function GET() {
  const denied = await denyIfNotAdmin()
  if (denied) return denied

  const supabase = supabaseAdmin()

  const { data: groups } = await supabase
    .from('groups')
    .select('id, tt_event_id')
    .eq('kind', 'brew')
  const groupRows = groups || []
  const groupIds = groupRows.map(g => g.id)
  if (!groupIds.length) {
    return Response.json({ ticketsByGroup: {}, seatsByContact: {}, groupHasEvent: {} })
  }

  const { data: events } = await supabase
    .from('events')
    .select('id, group_id')
    .in('group_id', groupIds)
  const eventToGroup = new Map((events || []).map(e => [e.id, e.group_id]))
  const groupHasEvent = {}
  for (const e of events || []) groupHasEvent[e.group_id] = true
  const ttToGroup = new Map(
    groupRows.filter(g => g.tt_event_id).map(g => [String(g.tt_event_id), g.id])
  )

  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const { data: paidOrders } = await supabase
    .from('orders')
    .select('id, contact_id, party_size, event_id, metadata, paid_at')
    .eq('status', 'paid')
    .gte('paid_at', since)

  const ticketsByGroup = {}
  const orderBuyer = new Map() // order_id → buyer contact_id, attributed orders only
  for (const o of paidOrders || []) {
    let gid = eventToGroup.get(o.event_id) || null
    if (!gid && o.metadata?.tt_event_id) {
      gid = ttToGroup.get(String(o.metadata.tt_event_id)) || null
    }
    if (!gid) continue
    ticketsByGroup[gid] = (ticketsByGroup[gid] || 0) + (Number(o.party_size) || 1)
    orderBuyer.set(o.id, o.contact_id || null)
  }

  const seatsByContact = {}
  const orderIds = [...orderBuyer.keys()]
  for (let i = 0; i < orderIds.length; i += 100) {
    const chunk = orderIds.slice(i, i + 100)
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, contact_id, voided_at')
      .in('order_id', chunk)
      .is('voided_at', null)
    for (const it of items || []) {
      const c = it.contact_id || orderBuyer.get(it.order_id)
      if (c) seatsByContact[c] = (seatsByContact[c] || 0) + 1
    }
  }

  return Response.json({ ticketsByGroup, seatsByContact, groupHasEvent })
}
