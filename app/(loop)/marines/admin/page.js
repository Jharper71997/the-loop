import { isLoopAdmin } from '@/lib/loopAdmin'
import LoopAdminGate from './LoopAdminGate'
import LoopAdminClient from './LoopAdminClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin' }

// The Loop admin — verification approval queue. Gated by the shared Loop
// access code (LOOP_ADMIN_CODE), separate from Brew Loop's login.
export default async function LoopAdminPage() {
  const ok = await isLoopAdmin()
  return ok ? <LoopAdminClient /> : <LoopAdminGate />
}
