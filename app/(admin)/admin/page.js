import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { serverNow } from '@/lib/serverNow'
import { operationalDateInTZ, nowInTZ, currentStopIndex, formatStopTime } from '@/lib/schedule'
import { getActiveBusiness } from '@/lib/businessServer'
import { resolveActiveLoop } from '@/lib/activeLoop'
import TonightClient from './TonightClient'

export const dynamic = 'force-dynamic'

export default async function TonightPage() {
  const supabase = supabaseAdmin()
  const business = await getActiveBusiness()
  const renderedAt = await serverNow()
  const today = operationalDateInTZ()
  const now = nowInTZ()

  // Which loop is on top is resolved against today rather than against the
  // first N open rows — see lib/activeLoop.js for the three weeks of August
  // this screen spent showing the Friday Aug 7 loop.
  //
  // A loop that already ran but hasn't been closed out stays the active loop so
  // staff can finish reporting / messaging / waivers until they close it out.
  const { todayGroup, ranGroup: ranOpenGroup, nextGroup, activeGroup, upcomingGroups } =
    await resolveActiveLoop(supabase, {
      business,   // active console's business (Brew /admin, Surf /surf, Marines /loop)
      select: `
        id, name, event_date, pickup_time, schedule, tt_event_id, closed_out_at,
        group_members (
          id, current_stop_index,
          contacts ( id, first_name, last_name, phone, has_signed_waiver )
        )
      `,
    })

  let state = 'none'
  let currentIdx = -1

  if (todayGroup) {
    const schedule = Array.isArray(todayGroup.schedule) ? todayGroup.schedule : []
    currentIdx = currentStopIndex(schedule, now, todayGroup.event_date, today)
    state = currentIdx >= 0 && currentIdx < schedule.length ? 'in_progress' : 'pre_pickup'
  } else if (ranOpenGroup) {
    // Already ran, still open: show the full roster + checkoff + broadcast so
    // staff can wrap up. All stops read as past.
    const schedule = Array.isArray(ranOpenGroup.schedule) ? ranOpenGroup.schedule : []
    currentIdx = schedule.length
    state = 'in_progress'
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
  const orderBuyer = new Map()

  function rollUpOrder(o) {
    if (!o?.id || seenOrderIds.has(o.id)) return
    seenOrderIds.add(o.id)
    totalTickets += Number(o.party_size) || 1
    orderBuyer.set(o.id, o.contact_id || null)
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

    // Seats per contact from order_items, crediting a group buy's unnamed seats
    // to the buyer — so a 4-ticket buyer counts as 4 at their stop while a named
    // companion (who has their own contact row) isn't double-counted.
    // totalTickets stays the party_size sum (the group's true ticket count).
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
        if (c) ticketsByContact[c] = (ticketsByContact[c] || 0) + 1
      }
    }
  }

  // Scope "Orders today" to THIS console's business so Marines/Surf paid orders
  // never appear on Brew /admin (and vice-versa). Brew orders are untagged
  // (metadata->>kind null); Marines/Surf carry metadata.kind.
  let ordersTodayQuery = supabase
    .from('orders')
    .select('id, buyer_name, buyer_phone, contact_id, event_id, total_cents, party_size, status, paid_at, metadata')
    .eq('status', 'paid')
    .gte('paid_at', `${today}T00:00:00`)
  ordersTodayQuery = business === 'brew'
    ? ordersTodayQuery.is('metadata->>kind', null)
    : ordersTodayQuery.eq('metadata->>kind', business)
  const { data: ordersToday } = await ordersTodayQuery
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
      renderedAt={renderedAt}
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
