// Push Loop-side consumption into Ticket Tailor so TT's own checkout reflects
// the shared 13-seat-per-stop physical cap.
//
// Implementation: TT's API does NOT support updating ticket_type.quantity_total
// directly (every PUT/PATCH path 404s — confirmed via /api/leadership/tt-probe).
// Instead we use TT's HOLDS resource — `POST /v1/holds` reserves N seats on a
// ticket type, reducing TT's available count atomically.
//
// Model: for each Loop ticket_type with a stop_index, we maintain ONE TT hold
// per stop, named `loop-bridge:{loop_ticket_type_id}`, whose quantity equals
// the number of Loop-native seats consumed at that stop (paid + fresh pending,
// ≤15 min).
//   - Loop sells/pendings 5 seats at HideAway → TT hold for HideAway = 5.
//   - Loop refund/void → hold decrements (delete + recreate at lower qty).
//   - Loop sells 0 → hold deleted entirely.
//
// TT's checkout math: `available = quantity_total - quantity_issued - quantity_held`.
// Our holds increment `quantity_held`, so TT instantly shows fewer seats
// remaining and refuses to sell past the shared cap.
//
// Reconcile strategy (per stop): find existing hold by name, compare quantity
// to target. If they match, no-op. Otherwise delete and re-create. This avoids
// needing an UPDATE endpoint (TT may or may not support hold updates; the
// delete-and-recreate path is universal).
//
// IMPORTANT: TT may reject hold creation if `quantity_total - issued < target`.
// If you've manually lowered `quantity_total` on a stop in the TT dashboard
// (older bridge workaround), reset it back to the physical capacity (e.g. 13)
// in TT before this sync can do its job.
//
// Best-effort + idempotent: safe to re-run any number of times. Callers
// (finalizeBooking, void route, /book pending creation, reconcile cron) should
// never fail their primary action if this errors — log and move on.

import { parseTicketTypeName } from './schedule.js'

const TT_BASE = 'https://api.tickettailor.com/v1'
const PENDING_CUTOFF_MINUTES = 15
// TT silently drops the `name` field we pass to POST /holds — only `note`
// persists. So we tag bridge-managed holds by a unique substring in the note
// and filter listings by that. To identify which Loop ticket_type a hold
// belongs to, we match the TT ticket_type_id inside `quantities[]` against
// the resolved ttMatch.id for each Loop stop.
const BRIDGE_NOTE = 'Auto-managed by Brew Loop app to mirror native checkout inventory. Do not delete manually.'
const BRIDGE_NOTE_MARKER = 'Brew Loop app to mirror native checkout inventory'

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

// Form-encoded POST. Supports nested-array body keys ({ 'ticket_type_id[tt_x]': 5 })
// which TT requires for the holds endpoint.
async function ttPost(path, body) {
  const auth = ttAuthHeader()
  if (!auth) return { ok: false, status: 0, reason: 'no_api_key' }
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body || {})) {
    if (v == null) continue
    form.set(k, String(v))
  }
  const res = await fetch(`${TT_BASE}${path}`, {
    method: 'POST',
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

async function ttDelete(path) {
  const auth = ttAuthHeader()
  if (!auth) return { ok: false, status: 0, reason: 'no_api_key' }
  const res = await fetch(`${TT_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: auth, Accept: 'application/json' },
  })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, json }
}

// List ALL bridge-owned holds across all events, identified by our marker
// substring in `note`. Returns a flat array so reconcile can filter per-event
// + per-tt-ticket-type at the callsite (we need ALL of them to detect and
// clean up duplicates from earlier racy/buggy runs).
async function listAllBridgeHolds() {
  const all = []
  let cursor = null
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ limit: '100' })
    if (cursor) qs.set('starting_after', cursor)
    const res = await ttGet(`/holds?${qs.toString()}`)
    if (!res.ok) break
    const list = Array.isArray(res.json?.data) ? res.json.data : []
    for (const h of list) {
      if (typeof h?.note !== 'string') continue
      if (!h.note.includes(BRIDGE_NOTE_MARKER)) continue
      all.push(h)
    }
    if (list.length < 100) break
    cursor = list[list.length - 1]?.id
    if (!cursor) break
  }
  return all
}

// TT's hold shape (verified via /v1/holds):
//   { id, event_id, note, quantities: [{ quantity, ticket_type_id }], total_on_hold, ... }
function holdQuantityFor(hold, ttTicketTypeId) {
  if (!hold || !Array.isArray(hold.quantities)) return 0
  const row = hold.quantities.find(q => q.ticket_type_id === ttTicketTypeId)
  return Number(row?.quantity) || 0
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

// Returns { updated: [...], skipped: [...], errors: [...], dry_run?: bool }
// Never throws — callers can fire-and-forget.
//
// Env kill switches:
//   TT_SYNC_DISABLED=1  — bail before any TT call.
//   TT_SYNC_DRYRUN=1    — log target deltas without creating/deleting holds.
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

    // One bulk GET for our bridge-owned holds — cheaper than one round-trip
    // per stop. We filter per-event + per-ticket-type at each iteration.
    const allBridgeHolds = await listAllBridgeHolds()
    const eventBridgeHolds = allBridgeHolds.filter(h => h.event_id === group.tt_event_id)

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

      // Count Loop-native consumed seats at this stop: paid + fresh pending
      // (≤15 min). Stale pendings are excluded; voided items always excluded.
      const pendingCutoff = new Date(Date.now() - PENDING_CUTOFF_MINUTES * 60 * 1000).toISOString()
      const paidQuery = supabase
        .from('order_items')
        .select('id, tt_ticket_id, orders!inner(id, event_id, status)', { count: 'exact', head: true })
        .eq('orders.event_id', eventId)
        .is('voided_at', null)
        .is('tt_ticket_id', null)
        .eq('orders.status', 'paid')
        .eq('stop_index', tt.stop_index)
      const pendingQuery = supabase
        .from('order_items')
        .select('id, tt_ticket_id, orders!inner(id, event_id, status, created_at)', { count: 'exact', head: true })
        .eq('orders.event_id', eventId)
        .is('voided_at', null)
        .is('tt_ticket_id', null)
        .eq('orders.status', 'pending')
        .gte('orders.created_at', pendingCutoff)
        .eq('stop_index', tt.stop_index)

      const [paidRes, pendingRes] = await Promise.all([paidQuery, pendingQuery])
      if (paidRes.error || pendingRes.error) {
        errors.push({
          ticket_type_id: tt.id,
          reason: 'count_failed',
          error: paidRes.error?.message || pendingRes.error?.message,
        })
        continue
      }
      const paidNative = paidRes.count || 0
      const pendingNative = pendingRes.count || 0
      const consumedNative = paidNative + pendingNative

      // Target hold size: how many seats Loop has consumed at this stop.
      // Never exceed `capacity - tt_issued` (TT would reject — hold cannot
      // make available go negative).
      const ttIssued = Number(ttMatch.quantity_issued) || 0
      const maxAllowed = Math.max(0, tt.capacity - ttIssued)
      const target = Math.min(consumedNative, maxAllowed)
      const tooMany = consumedNative > maxAllowed

      const existingList = eventBridgeHolds.filter(h =>
        Array.isArray(h.quantities) &&
        h.quantities.some(q => q.ticket_type_id === ttMatch.id),
      )
      const existingQty = existingList.reduce(
        (sum, h) => sum + holdQuantityFor(h, ttMatch.id),
        0,
      )

      // Fast path: nothing to reconcile.
      //   - exactly one hold with the right qty → no-op
      //   - zero holds and target=0 → nothing to do
      // Any other shape (duplicates, wrong qty, etc.) falls through to
      // delete + recreate.
      const correctSingle = existingList.length === 1 && existingQty === target
      const noopEmpty = existingList.length === 0 && target === 0
      if (correctSingle || noopEmpty) {
        skipped.push({
          ticket_type_id: tt.id,
          tt_ticket_type_id: ttMatch.id,
          reason: 'no_change',
          current_hold: existingQty,
        })
        continue
      }

      if (dryRun) {
        console.log('[tt-sync DRYRUN] would reconcile hold', {
          tt_ticket_type_id: ttMatch.id,
          stop: stopName,
          existing_count: existingList.length,
          existing_qty: existingQty,
          target,
          paid_native: paidNative,
          pending_native: pendingNative,
        })
        updated.push({
          stop_index: tt.stop_index,
          ticket_type_id: tt.id,
          tt_ticket_type_id: ttMatch.id,
          old_hold: existingQty,
          old_count: existingList.length,
          new_hold: target,
          paid_native: paidNative,
          pending_native: pendingNative,
          truncated_to_max: tooMany,
          dry_run: true,
        })
        continue
      }

      // Delete ALL existing bridge holds for this Loop ticket_type (handles
      // duplicates from prior racy reconciles), then recreate one fresh at
      // the new target qty. Skip the create when target=0 — that's the
      // "free the seats back" case after a refund/void.
      let deleteFailed = false
      for (const existing of existingList) {
        if (!existing?.id) continue
        const del = await ttDelete(`/holds/${existing.id}`)
        if (!del.ok) {
          errors.push({
            ticket_type_id: tt.id,
            tt_ticket_type_id: ttMatch.id,
            reason: 'tt_hold_delete_failed',
            status: del.status,
            body: del.json,
            hold_id: existing.id,
          })
          deleteFailed = true
          break
        }
      }
      if (deleteFailed) continue

      if (target > 0) {
        const created = await ttPost(`/holds`, {
          event_id: group.tt_event_id,
          [`ticket_type_id[${ttMatch.id}]`]: target,
          note: BRIDGE_NOTE,
        })
        if (!created.ok) {
          errors.push({
            ticket_type_id: tt.id,
            tt_ticket_type_id: ttMatch.id,
            reason: 'tt_hold_create_failed',
            status: created.status,
            body: created.json,
            target,
          })
          continue
        }
      }

      updated.push({
        stop_index: tt.stop_index,
        ticket_type_id: tt.id,
        tt_ticket_type_id: ttMatch.id,
        old_hold: existingQty,
        old_count: existingList.length,
        new_hold: target,
        paid_native: paidNative,
        pending_native: pendingNative,
        truncated_to_max: tooMany,
      })
    }

    return { updated, skipped, errors, dry_run: dryRun }
  } catch (err) {
    return { errors: [{ reason: 'sync_threw', error: err?.message || String(err) }] }
  }
}
