import { supabaseAdmin } from './supabaseAdmin'
import { currentStopIndex, nowInTZ, operationalDateInTZ, formatStopTime } from './schedule'

// Data for the simplified, live leadership home:
//   - live: what's happening on the active loop RIGHT NOW (or null)
//   - week: the four numbers that matter this week
//
// One round-trip; everything degrades to safe zeros/nulls if a table is empty.

function startOfWeek(d = new Date()) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfWeek(d = new Date()) {
  const end = new Date(startOfWeek(d))
  end.setDate(end.getDate() + 7)
  return end
}

// The loop staff are running/wrapping right now: the open (not closed-out) group
// for today, else the most recent loop that ran but isn't closed out, else next.
async function getActiveGroup(sb) {
  const today = operationalDateInTZ()
  const { data: groups } = await sb
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule, tt_event_id, closed_out_at')
    .is('closed_out_at', null)
    .order('event_date', { ascending: true })
    .limit(12)
  const open = groups || []
  const todayG = open.find(g => g.event_date === today)
  const ran = !todayG
    ? open.filter(g => g.event_date && g.event_date < today)
        .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))[0]
    : null
  const next = (!todayG && !ran)
    ? open.filter(g => !g.event_date || g.event_date > today)
        .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))[0]
    : null
  return { group: todayG || ran || next || null, today }
}

async function getLive(sb) {
  const { group, today } = await getActiveGroup(sb)
  if (!group) return null

  const schedule = Array.isArray(group.schedule) ? group.schedule : []
  const now = nowInTZ()
  const idx = currentStopIndex(schedule, now, group.event_date, today)

  let state // 'upcoming' | 'pre_pickup' | 'in_progress' | 'wrapping'
  if (group.event_date && group.event_date > today) state = 'upcoming'
  else if (idx == null || idx < 0) state = 'pre_pickup'
  else if (idx >= schedule.length) state = 'wrapping'
  else state = 'in_progress'

  const currentStop = (state === 'in_progress' && schedule[idx]) ? schedule[idx] : null
  const nextStop = state === 'pre_pickup'
    ? (schedule[0] || null)
    : (state === 'in_progress' ? (schedule[idx + 1] || null) : null)

  // Riders booked for this loop — party_size of paid orders across the group's
  // events (native) plus any TT-mirrored orders matched by tt_event_id.
  const { data: events } = await sb.from('events').select('id').eq('group_id', group.id)
  const eventIds = (events || []).map(e => e.id)

  let riders = 0
  let revenueCents = 0
  const seen = new Set()
  const roll = (o) => {
    if (!o?.id || seen.has(o.id)) return
    seen.add(o.id)
    riders += Number(o.party_size) || 1
    revenueCents += Number(o.total_cents) || 0
  }
  if (eventIds.length) {
    const { data: paid } = await sb
      .from('orders').select('id, party_size, total_cents').in('event_id', eventIds).eq('status', 'paid')
    for (const o of paid || []) roll(o)
  }
  if (group.tt_event_id) {
    const { data: tt } = await sb
      .from('orders').select('id, party_size, total_cents').eq('status', 'paid')
      .eq('metadata->>tt_event_id', String(group.tt_event_id))
    for (const o of tt || []) roll(o)
  }

  let waitlist = 0
  if (eventIds.length) {
    const { data: wl } = await sb.from('event_waitlist').select('party_size').in('event_id', eventIds)
    waitlist = (wl || []).reduce((s, w) => s + (Number(w.party_size) || 1), 0)
  }

  return {
    groupId: group.id,
    name: group.name || 'Brew Loop',
    eventDate: group.event_date || null,
    state,
    stopCount: schedule.length,
    currentStopIndex: state === 'in_progress' ? idx : null,
    currentStopName: currentStop?.name || null,
    nextStopName: nextStop?.name || null,
    nextStopTime: nextStop?.start_time ? formatStopTime(nextStop.start_time) : null,
    riders,
    revenueCents,
    waitlist,
  }
}

async function getWeek(sb) {
  const weekStart = startOfWeek().toISOString()
  const weekEnd = endOfWeek().toISOString()

  const [orders, sponsorPay, barPay, riderItems, bank, activeBars] = await Promise.all([
    sb.from('orders').select('total_cents')
      .eq('status', 'paid').is('refunded_at', null)
      .gte('paid_at', weekStart).lt('paid_at', weekEnd),
    sb.from('sponsor_payments').select('amount_cents').gte('paid_at', weekStart).lt('paid_at', weekEnd),
    sb.from('bar_payments').select('amount_cents').gte('paid_at', weekStart).lt('paid_at', weekEnd),
    sb.from('order_items')
      .select('id, orders!inner(status, paid_at)', { count: 'exact', head: true })
      .is('voided_at', null)
      .eq('orders.status', 'paid')
      .gte('orders.paid_at', weekStart).lt('orders.paid_at', weekEnd),
    sb.from('bank_balances').select('balance_cents, as_of').order('as_of', { ascending: false }).limit(1).maybeSingle(),
    sb.from('bars').select('slug', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const sum = (res) => (res?.data || []).reduce((s, r) => s + (r.amount_cents ?? r.total_cents ?? 0), 0)
  const revenueCents = sum(orders) + sum(sponsorPay) + sum(barPay)

  return {
    revenueCents,
    riders: riderItems?.count ?? 0,
    cashCents: bank?.data?.balance_cents ?? null,
    cashAsOf: bank?.data?.as_of ?? null,
    activeBars: activeBars?.count ?? 0,
  }
}

export async function getLeadershipHome() {
  const sb = supabaseAdmin()
  const [live, week] = await Promise.all([getLive(sb), getWeek(sb)])
  return { live, week }
}

export function formatCents(cents) {
  if (cents == null) return '—'
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1000) return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
