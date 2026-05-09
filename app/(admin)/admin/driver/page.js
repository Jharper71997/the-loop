import DriverClient from './DriverClient'
import { getUpcomingLoops } from '@/lib/upcomingLoops'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lookupBarsByNames } from '@/lib/barsServer'
import { generateStopsForEvent } from '@/lib/routeStopLogs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DriverPage() {
  let nextLoop = null
  try {
    const loops = await getUpcomingLoops({ limit: 1 })
    nextLoop = loops[0] || null
  } catch {}

  // Pull the schedule for the next loop so the map can show route stops.
  // Stop coords come from the merged static + DB lookup so leadership-added
  // bars get pinned without a code change.
  let stops = []
  let routeLog = []
  if (nextLoop?.groupId) {
    try {
      const sb = supabaseAdmin()
      const { data: g } = await sb
        .from('groups')
        .select('schedule')
        .eq('id', nextLoop.groupId)
        .maybeSingle()
      const schedule = Array.isArray(g?.schedule) ? g.schedule : []
      const barLookup = await lookupBarsByNames(sb, schedule.map(s => s?.name).filter(Boolean))
      stops = schedule.map((s, i) => {
        const bar = s?.name ? barLookup.get(s.name) : null
        return {
          index: i,
          name: s?.name || `Stop ${i + 1}`,
          startTime: s?.start_time || null,
          lat: bar?.lat ?? null,
          lng: bar?.lng ?? null,
        }
      })

      if (nextLoop?.id) {
        const fetchLogRows = async () => {
          const { data } = await sb
            .from('route_stop_logs')
            .select('*')
            .eq('event_id', nextLoop.id)
            .order('stop_index', { ascending: true })
          return data || []
        }
        routeLog = await fetchLogRows()

        // Self-heal: regenerate route_stop_logs whenever the cycle-1 schedule
        // doesn't match the seeded rows. Triggers in three cases:
        //   1. Empty log + non-empty schedule (initial seed).
        //   2. Schedule was edited after an initial seed (e.g. leadership
        //      added the other 4 bars after a one-bar seed) AND no driver
        //      arrivals are recorded yet — safe to overwrite.
        //   3. Same as 2 but the bars-per-cycle count changed.
        // generateStopsForEvent is idempotent and skips driver-filled rows,
        // so it's safe to call but we gate to avoid pointless writes.
        const seededBarsPerCycle = routeLog.length
          ? Math.max(...routeLog.map(r => Number(r.bar_position) || 0))
          : 0
        const anyLogged = routeLog.some(r => r.actual_arrival_at)
        const needsReseed =
          schedule.length > 0 && !anyLogged && seededBarsPerCycle !== schedule.length
        if (needsReseed) {
          await generateStopsForEvent(sb, nextLoop.id).catch(() => {})
          // After a reseed the row set may have grown (or shrunk); also drop
          // any obsolete rows whose stop_index is past the new total.
          const newTotal = schedule.length * 5
          try {
            await sb
              .from('route_stop_logs')
              .delete()
              .eq('event_id', nextLoop.id)
              .gt('stop_index', newTotal)
              .is('actual_arrival_at', null)
          } catch {}
          routeLog = await fetchLogRows()
        }
      }
    } catch {}
  }

  return (
    <DriverClient
      groupId={nextLoop?.groupId || null}
      eventId={nextLoop?.id || null}
      loopName={nextLoop?.name || null}
      eventDate={nextLoop?.eventDate || null}
      pickupTime={nextLoop?.pickupTime || null}
      stops={stops}
      initialRouteLog={routeLog}
    />
  )
}
