import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { operationalDateInTZ, nowInTZ, currentStopIndex, formatStopTime } from '@/lib/schedule'
import TonightClient from './TonightClient'

export const dynamic = 'force-dynamic'

export default async function TonightPage() {
  const supabase = supabaseAdmin()
  const today = operationalDateInTZ()
  const now = nowInTZ()

  const { data: groups } = await supabase
    .from('groups')
    .select(`
      id, name, event_date, pickup_time, schedule, tt_event_id,
      group_members (
        id, current_stop_index,
        contacts ( id, first_name, last_name, phone, has_signed_waiver )
      )
    `)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(4)

  const todayGroup = (groups || []).find(g => g.event_date === today) || null
  const nextGroup = !todayGroup ? (groups || [])[0] || null : null

  let state = 'none'
  let activeGroup = todayGroup || nextGroup
  let currentIdx = -1

  // Everything else on the schedule that isn't the one we're rendering on top.
  // The Schedule tab now shows what's live AND what's queued so the dispatcher
  // can scan the week from one screen.
  const upcomingGroups = (groups || []).filter(g => g.id !== activeGroup?.id).slice(0, 5)

  if (todayGroup) {
    const schedule = Array.isArray(todayGroup.schedule) ? todayGroup.schedule : []
    currentIdx = currentStopIndex(schedule, now, todayGroup.event_date, today)
    state = currentIdx >= 0 && currentIdx < schedule.length ? 'in_progress' : 'pre_pickup'
  } else if (nextGroup) {
    state = 'upcoming'
  }

  // Pull party_size from paid orders so multi-ticket buyers (TT-era) count
  // for their actual headcount, not just the buyer contact row. Two paths:
  //   1) Native /book: orders.event_id → events.group_id matches activeGroup.
  //   2) TT mirror: orders.metadata.tt_event_id matches group.tt_event_id.
  let ticketsByContact = {}
  let totalTickets = 0
  const seenOrderIds = new Set()

  function rollUpOrder(o) {
    if (!o?.id || seenOrderIds.has(o.id)) return
    seenOrderIds.add(o.id)
    const size = Number(o.party_size) || 1
    totalTickets += size
    if (o.contact_id) {
      ticketsByContact[o.contact_id] = (ticketsByContact[o.contact_id] || 0) + size
    }
  }

  if (activeGroup?.id) {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('group_id', activeGroup.id)
    const eventIds = (events || []).map(e => e.id)
    if (eventIds.length) {
      const { data: paidOrders } = await supabase
        .from('orders')
        .select('id, contact_id, party_size')
        .in('event_id', eventIds)
        .eq('status', 'paid')
      for (const o of paidOrders || []) rollUpOrder(o)
    }

    if (activeGroup.tt_event_id) {
      const { data: ttOrders } = await supabase
        .from('orders')
        .select('id, contact_id, party_size, metadata')
        .eq('status', 'paid')
        .eq('metadata->>tt_event_id', String(activeGroup.tt_event_id))
      for (const o of ttOrders || []) rollUpOrder(o)
    }
  }

  const { data: ordersToday } = await supabase
    .from('orders')
    .select('id, buyer_name, buyer_phone, contact_id, event_id, total_cents, party_size, status, paid_at, metadata')
    .eq('status', 'paid')
    .gte('paid_at', `${today}T00:00:00`)
    .order('paid_at', { ascending: false })
    .limit(5)

  // Per-order pickup-stop breakdown so the Orders today panel can render
  // "3 × Hideaway Lounge" instead of just "3 tickets". Order_items mirror
  // both Stripe-native checkouts and TT syncs (migration 008), so this
  // works for either source.
  const orderIds = (ordersToday || []).map(o => o.id)
  const { data: orderItemsToday } = orderIds.length
    ? await supabase
        .from('order_items')
        .select('order_id, stop_index')
        .in('order_id', orderIds)
    : { data: [] }

  const activeSchedule = Array.isArray(activeGroup?.schedule) ? activeGroup.schedule : []
  const orderStopBreakdown = {}
  for (const it of orderItemsToday || []) {
    const idx = it.stop_index
    const stopName = (idx != null && activeSchedule[idx]?.name) || (idx != null ? `Stop ${idx + 1}` : 'Unassigned')
    if (!orderStopBreakdown[it.order_id]) orderStopBreakdown[it.order_id] = {}
    orderStopBreakdown[it.order_id][stopName] = (orderStopBreakdown[it.order_id][stopName] || 0) + 1
  }

  return (
    <TonightClient
      state={state}
      today={today}
      group={activeGroup}
      currentIdx={currentIdx}
      ordersToday={ordersToday || []}
      orderStopBreakdown={orderStopBreakdown}
      ticketsByContact={ticketsByContact}
      totalTickets={totalTickets}
      upcomingGroups={upcomingGroups}
    />
  )
}
