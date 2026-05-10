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
        // doesn't match the seeded rows. Triggers when:
        //   1. Empty log + non-empty schedule (initial seed).
        //   2. Bars-per-cycle count changed (leadership added/removed bars).
        //   3. A bar in the schedule was swapped or renamed — same count,
        //      different name at a given position. This is the common live-
        //      run case: leadership tweaks the lineup after the initial seed.
        // generateStopsForEvent is idempotent and preserves rows the driver
        // has already filled (actual_arrival_at not null), so it's safe to
        // call even after the night has started.
        const seededBarsPerCycle = routeLog.length
          ? Math.max(...routeLog.map(r => Number(r.bar_position) || 0))
          : 0
        const cycle1Logged = routeLog.filter(r => r.cycle_index === 1)
        // Build "what cycle 1 should look like right now" and diff against
        // what's actually seeded. Any mismatched (position, name) on a row
        // the driver hasn't filled means we're stale.
        const expectedNames = schedule
          .map((s, i) => ({ pos: i + 1, name: (s?.name || '').trim() }))
          .filter(s => s.name)
        const seededByPos = new Map(
          cycle1Logged.map(r => [Number(r.bar_position) || 0, r])
        )
        const namesDiverged = expectedNames.some(({ pos, name }) => {
          const row = seededByPos.get(pos)
          if (!row) return true
          // If the driver already logged this slot, leave it alone.
          if (row.actual_arrival_at) return false
          return String(row.bar_name || '').trim() !== name
        })
        const countChanged = schedule.length > 0 && seededBarsPerCycle !== schedule.length
        const needsReseed = schedule.length > 0 && (countChanged || namesDiverged)
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
