import { isLoopAdmin } from '@/lib/loopAdmin'
import { getActiveMarinesLoop } from '@/lib/marinesLoop'
import LoopAdminGate from '../admin/LoopAdminGate'
import MarinesSecurityClient from './MarinesSecurityClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Door check-in' }

// The Loop (Marines) door check-in scanner. Code-gated by the shared Loop
// access code (same gate as /marines/admin), not Supabase auth.
export default async function MarinesSecurityPage() {
  const ok = await isLoopAdmin()
  if (!ok) return <LoopAdminGate />

  let eventName = 'The Loop'
  try {
    const loop = await getActiveMarinesLoop()
    if (loop?.name) eventName = loop.name
  } catch {}

  return <MarinesSecurityClient eventName={eventName} />
}
