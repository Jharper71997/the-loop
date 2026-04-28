import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shuttle/current — public.
// Returns the most recent shuttle_pings row from the last 5 minutes, or null
// if the shuttle is off duty / hasn't reported recently. /track polls this
// every ~10s.
const STALE_AFTER_MS = 5 * 60 * 1000

export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shuttle_pings')
    .select('lat, lng, speed_mph, heading, is_active, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return Response.json({ shuttle: null, error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ shuttle: null })
  }

  const age = Date.now() - new Date(data.recorded_at).getTime()
  if (age > STALE_AFTER_MS || !data.is_active) {
    return Response.json({ shuttle: null, last_seen_at: data.recorded_at })
  }

  return Response.json({ shuttle: data })
}
