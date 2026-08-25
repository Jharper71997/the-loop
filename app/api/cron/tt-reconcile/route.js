import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotCron } from '@/lib/cronAuth'
import { recordAlert } from '@/lib/alerts'
import { syncTtForEvent } from '@/lib/ticketTailorSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily reconciler. Walks every future on_sale event and pushes Loop-side
// consumption back to Ticket Tailor so TT's hosted checkout matches what the
// Loop has actually sold + held in pending carts.
//
// Why this exists even though syncTtForEvent already fires on every
// paid/pending/refund/void event:
//   1. A failed individual sync (TT outage, transient 500) leaves TT drifted
//      until the next Loop sale on that event. Daily reconciler catches it.
//   2. Stale Loop pendings that aged past the 15-min cutoff release seats
//      back, but the next Loop sale or void might be days away — TT would
//      show fewer seats than reality. Reconciler closes that gap.
//   3. External edits to TT's quantity_total (someone bumping it in the
//      dashboard) get clobbered back to the correct value within a day.
//
// Misconfig alerts: when a Loop ticket_type is set up to sync (has both
// capacity AND stop_index) but the matcher can't find a TT counterpart, that's
// an operational hole — overselling can still happen because TT is unaware.
// We fire one notifications row per (event, stop) per day so jacob sees it.

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const supabase = supabaseAdmin()
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

  const summary = {
    events_scanned: events.length,
    updates: 0,
    skips: 0,
    errors: 0,
    alerts_fired: 0,
    per_event: [],
  }

  for (const ev of events) {
    const result = await syncTtForEvent(supabase, ev.id)
    const updated = result.updated?.length || 0
    const skipped = result.skipped?.length || 0
    const errored = result.errors?.length || 0
    summary.updates += updated
    summary.skips += skipped
    summary.errors += errored

    for (const s of result.skipped || []) {
      if (s.reason !== 'no_tt_match') continue
      const fired = await maybeAlertNoTtMatch(supabase, { event: ev, skip: s })
      if (fired) summary.alerts_fired += 1
    }

    summary.per_event.push({
      event_id: ev.id,
      event_date: ev.event_date,
      name: ev.name,
      updated,
      skipped,
      errors: errored,
    })
  }

  return Response.json({ ok: true, ...summary })
}

// One alert per (event, stop) per 23h so the daily cron doesn't double-fire if
// it runs slightly late one day. The 23h window also dedupes a manual ad-hoc
// run that lands close to the scheduled run.
async function maybeAlertNoTtMatch(supabase, { event, skip }) {
  const kind = 'tt_no_match'
  const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('kind', kind)
    .eq('context->>event_id', event.id)
    .eq('context->>ticket_type_id', skip.ticket_type_id)
    .gte('created_at', since)
    .limit(1)

  if (existing?.length) return false

  await recordAlert(supabase, {
    kind,
    severity: 'warn',
    subject: `TT ticket type missing for "${skip.stop_name || 'unknown stop'}"`,
    body:
      `Event "${event.name}" (${event.event_date}) has a Loop ticket type with capacity + stop_index set, ` +
      `but no Ticket Tailor ticket type matches the stop name "${skip.stop_name || 'unknown'}". ` +
      `TT can't be told about the shared cap, so TT may oversell this stop. ` +
      `Fix: rename the TT ticket type (or the Loop schedule stop) so they match exactly.`,
    context: {
      event_id: event.id,
      event_date: event.event_date,
      ticket_type_id: skip.ticket_type_id,
      stop_name: skip.stop_name || null,
    },
  })
  return true
}
