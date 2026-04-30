import DriverClient from './DriverClient'
import { getUpcomingLoops } from '@/lib/upcomingLoops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DriverPage() {
  let nextLoop = null
  try {
    const loops = await getUpcomingLoops({ limit: 1 })
    nextLoop = loops[0] || null
  } catch {}

  return (
    <DriverClient
      groupId={nextLoop?.groupId || null}
      loopName={nextLoop?.name || null}
      eventDate={nextLoop?.eventDate || null}
      pickupTime={nextLoop?.pickupTime || null}
    />
  )
}
