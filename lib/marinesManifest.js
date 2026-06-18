import { supabaseAdmin } from './supabaseAdmin'

// Driver manifest for a Marines loop: every paid ticket (order_item) across the
// loop's events, with rider name + pass type + chosen boarding stop + whether
// they're currently on board. "On board" = the rider's most recent
// loop_boardings row for this group is action='board'.
//
// Day Pass riders re-board freely; Single Ride riders show "boarded" once used
// (re-boarding is another $10 — enforced by eyeball, not hard-blocked, per the
// locked model). Returns { riders: [...] }.
export async function getMarinesManifest(groupId) {
  if (!groupId) return { riders: [] }
  const sb = supabaseAdmin()

  const { data: events } = await sb.from('events').select('id').eq('group_id', groupId)
  const eventIds = (events || []).map(e => e.id)
  if (!eventIds.length) return { riders: [] }

  const { data: items } = await sb
    .from('order_items')
    .select('id, contact_id, rider_first_name, rider_last_name, pickup_stop_index, stop_index, ticket_type:ticket_types(name), orders!inner(status, event_id, buyer_name)')
    .in('orders.event_id', eventIds)
    .eq('orders.status', 'paid')
    .is('voided_at', null)

  const { data: boardings } = await sb
    .from('loop_boardings')
    .select('order_item_id, contact_id, action, created_at, stop_index')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  // Latest boarding row per order_item (chronological scan → last wins).
  const lastByItem = new Map()
  for (const b of boardings || []) {
    if (b.order_item_id) lastByItem.set(b.order_item_id, b)
  }

  const riders = (items || []).map(it => {
    const last = lastByItem.get(it.id)
    const name = [it.rider_first_name, it.rider_last_name].filter(Boolean).join(' ').trim()
      || it.orders?.buyer_name || 'Rider'
    const pass = it.ticket_type?.name || 'Ride'
    const pickup = Number.isInteger(it.pickup_stop_index)
      ? it.pickup_stop_index
      : (Number.isInteger(it.stop_index) ? it.stop_index : null)
    return {
      order_item_id: it.id,
      contact_id: it.contact_id || null,
      name,
      pass,
      is_day_pass: /day\s*pass/i.test(pass),
      pickup_stop_index: pickup,
      on_board: last?.action === 'board',
      last_stop_index: Number.isInteger(last?.stop_index) ? last.stop_index : null,
    }
  })

  return { riders }
}
