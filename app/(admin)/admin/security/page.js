import SecurityClient from './SecurityClient'
import { getActiveAdminLoop } from '@/lib/upcomingLoops'
import { getActiveBusiness } from '@/lib/businessServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  // Active loop's event id powers the "shuttle 5 min away" prompt (the door
  // crew can fire the heads-up too, not just the driver). Best-effort — the
  // scanner must still load if there's no on-sale loop.
  let eventId = null
  try {
    const business = await getActiveBusiness()
    const loop = await getActiveAdminLoop(business)
    eventId = loop?.id || null
  } catch {}

  return <SecurityClient eventId={eventId} />
}
