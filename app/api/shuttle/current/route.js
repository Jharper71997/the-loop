import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shuttle/current — public.
// Returns the most recent shuttle_pings row from the last 5 minutes, or null
// if the shuttle is off duty / hasn't reported recently. /track polls this
// every ~10s.
//
// Also returns `next_stop` — the lowest-stop_index row in route_stop_logs for
// tonight's on-sale event whose actual_arrival_at is still null. That's the
// bar the shuttle is heading to next. As the driver logs each stop, the
// public /track view advances on the next poll. Falls back to null when no
// event is on tonight or all 25 stops are logged.
const STALE_AFTER_MS = 5 * 60 * 1000

export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shuttle_pings')
    .select('lat, lng, speed_mph, heading, is_active, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return Response.json({ shuttle: null, error: error.message }, { status: 500 })
  }

  const nextStop = await loadNextStop(admin).catch(() => null)

  if (!data) {
    return Response.json({ shuttle: null, next_stop: nextStop })
  }

  const age = Date.now() - new Date(data.recorded_at).getTime()
  if (age > STALE_AFTER_MS || !data.is_active) {
    return Response.json({ shuttle: null, last_seen_at: data.recorded_at, next_stop: nextStop })
  }

  return Response.json({ shuttle: data, next_stop: nextStop })
}

async function loadNextStop(admin) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: eventRow } = await admin
    .from('events')
    .select('id')
    .eq('status', 'on_sale')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!eventRow?.id) return null

  const { data: row } = await admin
    .from('route_stop_logs')
    .select('bar_name, bar_slug, stop_index, cycle_index, bar_position, scheduled_at')
    .eq('event_id', eventRow.id)
    .is('actual_arrival_at', null)
    .order('stop_index', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!row) return null

  return {
    bar_name: row.bar_name,
    bar_slug: row.bar_slug,
    stop_index: row.stop_index,
    cycle_index: row.cycle_index,
    bar_position: row.bar_position,
    scheduled_at: row.scheduled_at,
  }
}
