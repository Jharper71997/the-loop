import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { syncTtForEvent } from '@/lib/ticketTailorSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// One-click manual TT resync. Same work as /api/cron/tt-reconcile but gated by
// leadership auth instead of CRON_SECRET, so Jacob can fire it from a browser
// devtools console without dealing with the cron secret.
//
// Before syncing, auto-link any future Loop group that has a null tt_event_id
// to a TT event with the same date. That covers the case where admins create
// Loops natively (in /admin/loops/new) and the matching TT event was created
// separately — without linkage, syncTtForEvent skips with no_tt_event_id and
// the channels drift.
//
// Usage:
//   fetch('/api/leadership/tt-resync', { method: 'POST' }).then(r => r.json()).then(console.log)

// Walk TT's event list, match by date, write tt_event_id back to groups.
async function autoLinkByDate(supabase) {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return { linked: [], error: 'no_api_key' }
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')

  // TT paginates events; 100 is the max page size. For the foreseeable future
  // (a dozen weekends out) one page is plenty.
  const res = await fetch('https://api.tickettailor.com/v1/events?limit=100', {
    headers: { Authorization: auth, Accept: 'application/json' },
  })
  if (!res.ok) return { linked: [], error: `tt_fetch_${res.status}` }
  const data = await res.json().catch(() => null)
  const ttEvents = Array.isArray(data?.data) ? data.data : []

  // Map TT event_date -> first TT event id. If two TT events share a date,
  // the first wins; in practice we have one event per (date, time) and the
  // sync matcher works per stop name afterwards, so this is fine.
  const ttByDate = new Map()
  for (const e of ttEvents) {
    const date = e.start?.date
    if (!date) continue
    if (!ttByDate.has(date)) ttByDate.set(date, String(e.id))
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: unlinked } = await supabase
    .from('groups')
    .select('id, event_date')
    .gte('event_date', today)
    .is('tt_event_id', null)

  const linked = []
  for (const g of unlinked || []) {
    const ttId = ttByDate.get(g.event_date)
    if (!ttId) continue
    const { error } = await supabase
      .from('groups')
      .update({ tt_event_id: ttId })
      .eq('id', g.id)
    if (!error) {
      linked.push({ group_id: g.id, event_date: g.event_date, tt_event_id: ttId })
    }
  }
  return { linked }
}

export async function POST() {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const supabase = supabaseAdmin()

  // First, auto-link any unlinked Loop groups to their TT counterparts so the
  // following sync pass doesn't skip them with no_tt_event_id.
  const autoLink = await autoLinkByDate(supabase)

  const today = new Date().toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date')
    .gte('event_date', today)
    .eq('status', 'on_sale')
    .order('event_date', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!events?.length) {
    return Response.json({ ok: true, events_scanned: 0, message: 'no_future_events' })
  }

  const per_event = []
  let total_updates = 0
  let total_skips = 0
  let total_errors = 0

  for (const ev of events) {
    const result = await syncTtForEvent(supabase, ev.id)
    const updated = result.updated || []
    const skipped = result.skipped || []
    const errors = result.errors || []
    total_updates += updated.length
    total_skips += skipped.length
    total_errors += errors.length

    per_event.push({
      event_id: ev.id,
      event_date: ev.event_date,
      name: ev.name,
      updated: updated.map(u => ({
        stop_index: u.stop_index,
        from_hold: u.old_hold,
        from_count: u.old_count,
        to_hold: u.new_hold,
        paid_native: u.paid_native,
        pending_native: u.pending_native,
        truncated_to_max: u.truncated_to_max,
      })),
      skipped: skipped.filter(s => s.reason !== 'no_change').map(s => ({
        reason: s.reason,
        stop_name: s.stop_name,
        ticket_type_id: s.ticket_type_id,
      })),
      errors,
    })
  }

  return Response.json({
    ok: true,
    auto_linked: autoLink,
    events_scanned: events.length,
    total_updates,
    total_skips,
    total_errors,
    per_event,
  })
}
