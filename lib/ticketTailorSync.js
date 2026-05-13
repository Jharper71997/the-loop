// Push Loop-side consumption into Ticket Tailor so TT's own checkout reflects
// the shared 13-seat-per-stop physical cap.
//
// Model: each Loop ticket_type has a `capacity` and a `stop_index`. The Loop
// capacity check (api/checkout/route.js) already enforces the cap across both
// channels by counting order_items at the same (event_id, stop_index). This
// module is the OTHER direction — it tells TT how many seats remain so a
// shopper on TT's hosted checkout sees the same number.
//
// For each Loop ticket_type with a stop_index, we PUT to TT:
//     ticket_type.quantity_total = capacity - paid_native_loop_count
//
// TT's "available" = quantity_total - quantity_issued - quantity_held. Since
// quantity_issued reflects TT's own paid tickets (already mirrored into our
// orders table), subtracting only paid_native_loop on our side gives TT the
// right ceiling without double-counting its own sales.
//
// Best-effort + idempotent: safe to re-run any number of times. Callers
// (finalizeBooking + the void route) should never fail their primary action if
// this errors — log and move on.

import { parseTicketTypeName } from './schedule'

const TT_BASE = 'https://api.tickettailor.com/v1'

function ttAuthHeader() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

async function ttGet(path) {
  const auth = ttAuthHeader()
  if (!auth) return { ok: false, status: 0, reason: 'no_api_key' }
  const res = await fetch(`${TT_BASE}${path}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, json }
}

async function ttPut(path, body) {
  const auth = ttAuthHeader()
  if (!auth) return { ok: false, status: 0, reason: 'no_api_key' }
  // TT accepts both JSON and form-encoded; their docs lean form-encoded so
  // mirror that to match the rest of lib/ticketTailorVouchers.js conventions.
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body || {})) {
    if (v == null) continue
    form.set(k, String(v))
  }
  const res = await fetch(`${TT_BASE}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, json }
}

// Same matching logic as the inbound direction (lib/ticketTailor.js
// matchStopIndex) — TT ticket descriptions are usually "Bar Name - 7:30 PM",
// sometimes plain "Bar Name", sometimes "Bar Name - VIP". Try the parsed name
// first, then the raw description, then the substring before the dash.
function matchTtTicketTypeForStop(ttTicketTypes, stopName) {
  if (!stopName) return null
  const target = String(stopName).toLowerCase().trim()
  if (!target) return null

  for (const tt of ttTicketTypes) {
    const candidates = []
    const raw = tt.description || tt.name || ''
    if (raw) {
      const parsed = parseTicketTypeName(raw)
      if (parsed?.name) candidates.push(parsed.name)
      candidates.push(raw)
      const dashSplit = String(raw).split(/\s*[-–—]\s*/)[0]
      if (dashSplit && dashSplit !== raw) candidates.push(dashSplit)
    }
    for (const c of candidates) {
      if (String(c).toLowerCase().trim() === target) return tt
    }
  }
  return null
}

// Returns { updated: [{ stop_index, tt_ticket_type_id, old, new, available }],
//           skipped: [...], errors: [...], dry_run?: bool }
// Never throws — callers can fire-and-forget.
//
// Env kill switches:
//   TT_SYNC_DISABLED=1  — bail before any TT call (use this if TT is having
//                         issues during a live weekend and you need to stop
//                         writes without redeploying logic).
//   TT_SYNC_DRYRUN=1    — compute what would change and log it, but skip the
//                         PUT. Use this for the first deploy to verify the
//                         math against live data before enabling writes.
export async function syncTtForEvent(supabase, eventId) {
  if (!eventId) return { skipped: [{ reason: 'no_event_id' }] }
  if (process.env.TT_SYNC_DISABLED === '1') return { skipped: [{ reason: 'tt_sync_disabled' }] }
  if (!ttAuthHeader()) return { skipped: [{ reason: 'no_api_key' }] }
  const dryRun = process.env.TT_SYNC_DRYRUN === '1'

  try {
    const { data: event } = await supabase
      .from('events')
      .select('id, group_id')
      .eq('id', eventId)
      .maybeSingle()
    if (!event) return { skipped: [{ reason: 'event_not_found' }] }
    if (!event.group_id) return { skipped: [{ reason: 'no_group' }] }

    const { data: group } = await supabase
      .from('groups')
      .select('id, tt_event_id, schedule')
      .eq('id', event.group_id)
      .maybeSingle()
    if (!group?.tt_event_id) return { skipped: [{ reason: 'no_tt_event_id' }] }

    const { data: ticketTypes } = await supabase
      .from('ticket_types')
      .select('id, name, capacity, stop_index, active')
      .eq('event_id', eventId)
    if (!ticketTypes?.length) return { skipped: [{ reason: 'no_ticket_types' }] }

    const ttRes = await ttGet(`/events/${group.tt_event_id}`)
    if (!ttRes.ok || !ttRes.json) {
      return { errors: [{ reason: 'tt_event_fetch_failed', status: ttRes.status }] }
    }
    const ttTicketTypes = Array.isArray(ttRes.json.ticket_types) ? ttRes.json.ticket_types : []
    const schedule = Array.isArray(group.schedule) ? group.schedule : []

    const updated = []
    const skipped = []
    const errors = []

    for (const tt of ticketTypes) {
      if (!tt.active) { skipped.push({ ticket_type_id: tt.id, reason: 'inactive' }); continue }
      if (tt.capacity == null) { skipped.push({ ticket_type_id: tt.id, reason: 'no_capacity' }); continue }
      if (tt.stop_index == null) { skipped.push({ ticket_type_id: tt.id, reason: 'no_stop_index' }); continue }

      const stopName = schedule[tt.stop_index]?.name
      if (!stopName) { skipped.push({ ticket_type_id: tt.id, reason: 'stop_name_missing' }); continue }

      const ttMatch = matchTtTicketTypeForStop(ttTicketTypes, stopName)
      if (!ttMatch) { skipped.push({ ticket_type_id: tt.id, stop_name: stopName, reason: 'no_tt_match' }); continue }

      // Count Loop-native paid items at this stop. Pending is intentionally
      // excluded — pending Loop carts shouldn't make TT show fewer seats than
      // exist, because pendings expire after 15 min and the next sale-or-void
      // re-syncs. (Tradeoff: TT could briefly oversell into a Loop pending
      // window, but the Loop capacity check will catch it server-side at the
      // pending → paid transition for either channel.)
      let nativeQuery = supabase
        .from('order_items')
        .select('id, tt_ticket_id, orders!inner(id, event_id, status)', { count: 'exact', head: true })
        .eq('orders.event_id', eventId)
        .is('voided_at', null)
        .is('tt_ticket_id', null)
        .eq('orders.status', 'paid')
      // Count by stop_index when set (the normal case); fall back to
      // ticket_type_id for legacy items missing stop_index.
      nativeQuery = nativeQuery.eq('stop_index', tt.stop_index)
      const { count: paidNative, error: countErr } = await nativeQuery
      if (countErr) {
        errors.push({ ticket_type_id: tt.id, reason: 'count_failed', error: countErr.message })
        continue
      }

      const ttIssued = Number(ttMatch.quantity_issued) || 0
      const ttHeld = Number(ttMatch.quantity_held) || 0
      const ttCurrentTotal = Number(ttMatch.quantity_total) || 0

      // Target: capacity - native_paid. Never drop below tt_issued + tt_held
      // (TT would reject it or be left in an inconsistent state) and never
      // exceed the physical capacity (some external TT edit could otherwise
      // have raised quantity_total above 13).
      const floor = ttIssued + ttHeld
      const target = Math.max(floor, Math.min(tt.capacity, tt.capacity - (paidNative || 0)))

      if (target === ttCurrentTotal) {
        skipped.push({ ticket_type_id: tt.id, tt_ticket_type_id: ttMatch.id, reason: 'no_change', current: ttCurrentTotal })
        continue
      }

      if (dryRun) {
        console.log('[tt-sync DRYRUN] would PUT', {
          tt_ticket_type_id: ttMatch.id,
          stop: stopName,
          from: ttCurrentTotal,
          to: target,
          paid_native: paidNative || 0,
        })
        updated.push({
          stop_index: tt.stop_index,
          ticket_type_id: tt.id,
          tt_ticket_type_id: ttMatch.id,
          old: ttCurrentTotal,
          new: target,
          available: target - floor,
          paid_native: paidNative || 0,
          dry_run: true,
        })
        continue
      }

      const put = await ttPut(`/ticket_types/${ttMatch.id}`, { quantity_total: target })
      if (!put.ok) {
        errors.push({
          ticket_type_id: tt.id,
          tt_ticket_type_id: ttMatch.id,
          reason: 'tt_put_failed',
          status: put.status,
          body: put.json,
          target,
          previous: ttCurrentTotal,
        })
        continue
      }

      updated.push({
        stop_index: tt.stop_index,
        ticket_type_id: tt.id,
        tt_ticket_type_id: ttMatch.id,
        old: ttCurrentTotal,
        new: target,
        available: target - floor,
        paid_native: paidNative || 0,
      })
    }

    return { updated, skipped, errors, dry_run: dryRun }
  } catch (err) {
    return { errors: [{ reason: 'sync_threw', error: err?.message || String(err) }] }
  }
}
