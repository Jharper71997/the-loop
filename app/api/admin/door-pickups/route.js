import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotAdmin } from '@/lib/routeAuth'
import { buildDoorPickupBoard } from '@/lib/doorPickupBoard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/door-pickups
// Door pickup boarding lists for the Loops page (it runs client-side with the
// anon key, and RLS hides orders). Addresses and phones, so staff-gated.
export async function GET() {
  const denied = await denyIfNotAdmin()
  if (denied) return denied
  const events = await buildDoorPickupBoard(supabaseAdmin())
  return Response.json({ events })
}
