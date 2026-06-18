import { isLoopDriver } from '@/lib/loopDriver'
import { getActiveMarinesLoop } from '@/lib/marinesLoop'
import { getMarinesManifest } from '@/lib/marinesManifest'
import LoopDriverGate from './LoopDriverGate'
import LoopDriverClient from './LoopDriverClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Driver' }

// The Loop driver surface — standalone, code-gated (LOOP_DRIVER_CODE), no
// Supabase login. Shows the route, broadcasts GPS, and runs a live manifest of
// who's on board / waiting at which stop. Separate from the Brew Loop driver.
export default async function LoopDriverPage() {
  if (!(await isLoopDriver())) return <LoopDriverGate />

  let loop = null
  try { loop = await getActiveMarinesLoop() } catch {}

  let manifest = { riders: [] }
  if (loop?.groupId) {
    try { manifest = await getMarinesManifest(loop.groupId) } catch {}
  }

  return (
    <LoopDriverClient
      groupId={loop?.groupId || null}
      eventId={loop?.eventId || null}
      loopName={loop?.name || null}
      eventDate={loop?.eventDate || null}
      pickupTime={loop?.pickupTime || null}
      stops={loop?.stops || []}
      initialManifest={manifest.riders || []}
    />
  )
}
