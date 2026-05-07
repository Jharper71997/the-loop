import DriverClient from './DriverClient'
import { getUpcomingLoops } from '@/lib/upcomingLoops'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lookupBarsByNames } from '@/lib/barsServer'

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
        const { data: logRows } = await sb
          .from('route_stop_logs')
          .select('*')
          .eq('event_id', nextLoop.id)
          .order('stop_index', { ascending: true })
        routeLog = logRows || []
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
