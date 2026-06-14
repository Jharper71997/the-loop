import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Dump every order_item for a specific event + stop, plus the matching TT
// hold/ticket_type state, so we can reconcile why the bridge sees N riders
// when the human-counted total is M.
//
// Usage:
//   fetch('/api/leadership/tt-debug?event_date=2026-05-15&stop_index=0').then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)))

export async function GET(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const url = new URL(req.url)
  const eventDate = url.searchParams.get('event_date')
  const stopIndex = url.searchParams.get('stop_index')
  if (!eventDate) {
    return Response.json({ error: 'event_date required (e.g. 2026-05-15)' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, group_id, status')
    .eq('event_date', eventDate)

  if (!events?.length) return Response.json({ error: 'no event for that date' }, { status: 404 })

  const out = []
  for (const ev of events) {
    const { data: group } = await supabase
      .from('groups')
      .select('id, tt_event_id, schedule')
      .eq('id', ev.group_id)
      .maybeSingle()

    const { data: ticketTypes } = await supabase
      .from('ticket_types')
      .select('id, name, capacity, stop_index, active')
      .eq('event_id', ev.id)

    let itemsQuery = supabase
      .from('order_items')
      .select('id, stop_index, voided_at, tt_ticket_id, orders!inner(id, event_id, status, created_at)')
      .eq('orders.event_id', ev.id)
    if (stopIndex !== null && stopIndex !== '') {
      itemsQuery = itemsQuery.eq('stop_index', parseInt(stopIndex, 10))
    }
    const { data: items } = await itemsQuery

    const now = Date.now()
    const breakdown = (items || []).map(item => {
      const ageMin = Math.round((now - new Date(item.orders.created_at).getTime()) / 60000)
      const channel = item.tt_ticket_id ? 'tt' : 'loop'
      let counts_toward_bridge = false
      if (channel === 'loop' && !item.voided_at) {
        if (item.orders.status === 'paid') counts_toward_bridge = true
        else if (item.orders.status === 'pending' && ageMin <= 15) counts_toward_bridge = true
      }
      return {
        order_item_id: item.id,
        stop_index: item.stop_index,
        stop_name: group?.schedule?.[item.stop_index]?.name || null,
        channel,
        order_status: item.orders.status,
        voided: !!item.voided_at,
        tt_ticket_id: item.tt_ticket_id,
        age_minutes: ageMin,
        counts_toward_bridge,
      }
    })

    out.push({
      event_id: ev.id,
      event_name: ev.name,
      event_date: ev.event_date,
      status: ev.status,
      tt_event_id: group?.tt_event_id || null,
      ticket_types: ticketTypes,
      schedule: group?.schedule,
      order_items: breakdown,
      summary: {
        total_items: breakdown.length,
        loop_paid: breakdown.filter(b => b.channel === 'loop' && b.order_status === 'paid' && !b.voided).length,
        loop_pending_fresh: breakdown.filter(b => b.channel === 'loop' && b.order_status === 'pending' && !b.voided && b.age_minutes <= 15).length,
        loop_pending_stale: breakdown.filter(b => b.channel === 'loop' && b.order_status === 'pending' && !b.voided && b.age_minutes > 15).length,
        loop_voided: breakdown.filter(b => b.channel === 'loop' && b.voided).length,
        tt_mirrored: breakdown.filter(b => b.channel === 'tt' && !b.voided).length,
      },
    })
  }

  return Response.json({ ok: true, events: out })
}
