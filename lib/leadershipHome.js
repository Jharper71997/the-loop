import { supabaseAdmin } from './supabaseAdmin'
import { currentStopIndex, nowInTZ, operationalDateInTZ, formatStopTime } from './schedule'
import { resolveActiveLoop } from './activeLoop'

// Data for the simplified, live leadership home:
//   - live: what's happening on the active loop RIGHT NOW (or null)
//   - week: the four numbers that matter this week
//
// One round-trip; everything degrades to safe zeros/nulls if a table is empty.

// Two loop dates belong to the same weekend if they are within a couple of
// nights of each other — Friday and Saturday, not Saturday and next Friday.
function withinNights(a, b, nights = 2) {
  if (!a || !b) return false
  const diff = Math.abs((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000)
  return diff <= nights
}

// The loop staff are running/wrapping right now: the open (not closed-out) group
// for today, else the most recent loop that ran but isn't closed out, else next.
async function getActiveGroup(sb) {
  // leadership "Tonight" strip is Brew Loop only
  const { activeGroup, today } = await resolveActiveLoop(sb, {
    business: 'brew',
    select: 'id, name, event_date, pickup_time, schedule, tt_event_id, closed_out_at',
  })
  return { group: activeGroup, today }
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

// Riders and ticket revenue for a set of loops. Two sources, same as
// everywhere else: orders against the loop's own events (native /book) and
// orders mirrored from Ticket Tailor by tt_event_id.
async function loopTotals(sb, groups) {
  const ids = groups.map(g => g.id).filter(Boolean)
  let riders = 0
  let revenueCents = 0
  if (!ids.length) return { riders, revenueCents }

  const seen = new Set()
  const roll = (o) => {
    if (!o?.id || seen.has(o.id)) return
    seen.add(o.id)
    riders += Number(o.party_size) || 1
    revenueCents += Number(o.total_cents) || 0
  }

  const { data: events } = await sb.from('events').select('id').in('group_id', ids)
  const eventIds = (events || []).map(e => e.id)
  if (eventIds.length) {
    const { data } = await sb.from('orders')
      .select('id, party_size, total_cents')
      .in('event_id', eventIds).eq('status', 'paid').is('refunded_at', null)
    for (const o of data || []) roll(o)
  }

  // One query per TT id rather than an .in() through a JSON arrow — it is at
  // most two nights, and the arrow form is easy to get subtly wrong.
  for (const tt of groups.map(g => g.tt_event_id).filter(Boolean)) {
    const { data } = await sb.from('orders')
      .select('id, party_size, total_cents')
      .eq('status', 'paid').is('refunded_at', null)
      .eq('metadata->>tt_event_id', String(tt))
    for (const o of data || []) roll(o)
  }

  return { riders, revenueCents }
}

// The Loop runs Friday and Saturday. A Monday-to-Sunday window is therefore
// empty from Monday morning until Friday night, which is exactly when someone
// is most likely to be looking at this page — it read $0 / 0 riders five days
// out of seven and looked broken. Both numbers are weekend-shaped now: what
// last weekend did, and what the coming weekend has sold so far.
async function getWeekend(sb) {
  const today = operationalDateInTZ()
  const sel = 'id, name, event_date, tt_event_id'

  const [pastRes, futureRes, bank] = await Promise.all([
    sb.from('groups').select(sel).eq('kind', 'brew')
      .lt('event_date', today).order('event_date', { ascending: false }).limit(4),
    sb.from('groups').select(sel).eq('kind', 'brew')
      .gte('event_date', today).order('event_date', { ascending: true }).limit(4),
    sb.from('bank_balances').select('balance_cents, as_of')
      .order('as_of', { ascending: false }).limit(1).maybeSingle(),
  ])

  const past = pastRes?.data || []
  const future = futureRes?.data || []
  const lastNight = past[0]?.event_date || null
  const nextNight = future[0]?.event_date || null

  const lastWeekend = lastNight ? past.filter(g => withinNights(g.event_date, lastNight)) : []
  const thisWeekend = nextNight ? future.filter(g => withinNights(g.event_date, nextNight)) : []

  const [last, coming] = await Promise.all([
    loopTotals(sb, lastWeekend),
    loopTotals(sb, thisWeekend),
  ])

  const cashAsOf = bank?.data?.as_of ?? null
  const cashAgeDays = cashAsOf
    ? Math.floor((Date.now() - new Date(cashAsOf).getTime()) / 86400000)
    : null

  return {
    last: { ...last, dates: lastWeekend.map(g => g.event_date).filter(Boolean).sort() },
    coming: { ...coming, dates: thisWeekend.map(g => g.event_date).filter(Boolean).sort() },
    cashCents: bank?.data?.balance_cents ?? null,
    cashAsOf,
    cashAgeDays,
  }
}

export async function getLeadershipHome() {
  const sb = supabaseAdmin()
  const [live, weekend] = await Promise.all([getLive(sb), getWeekend(sb)])
  return { live, weekend }
}

export function formatCents(cents) {
  if (cents == null) return '—'
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1000) return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
