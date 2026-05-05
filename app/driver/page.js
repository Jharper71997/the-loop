import DriverClient from './DriverClient'
import { getUpcomingLoops } from '@/lib/upcomingLoops'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getBarByName } from '@/lib/bars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DriverPage() {
  let nextLoop = null
  try {
    const loops = await getUpcomingLoops({ limit: 1 })
    nextLoop = loops[0] || null
  } catch {}

  // Pull the schedule for the next loop so the map can show route stops.
  // Same lookup pattern as /track — schedule lives on groups.schedule and
  // stop coords come from lib/bars.js via getBarByName.
  let stops = []
  if (nextLoop?.groupId) {
    try {
      const sb = supabaseAdmin()
      const { data: g } = await sb
        .from('groups')
        .select('schedule')
        .eq('id', nextLoop.groupId)
        .maybeSingle()
      const schedule = Array.isArray(g?.schedule) ? g.schedule : []
      stops = schedule.map((s, i) => {
        const bar = getBarByName(s?.name)
        return {
          index: i,
          name: s?.name || `Stop ${i + 1}`,
          startTime: s?.start_time || null,
          lat: bar?.lat ?? null,
          lng: bar?.lng ?? null,
        }
      })
    } catch {}
  }

  return (
    <DriverClient
      groupId={nextLoop?.groupId || null}
      loopName={nextLoop?.name || null}
      eventDate={nextLoop?.eventDate || null}
      pickupTime={nextLoop?.pickupTime || null}
      stops={stops}
    />
  )
}
