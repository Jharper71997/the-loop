import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isDriver } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/shuttle/ping — driver-only.
// Body: { lat, lng, speed?, heading?, group_id?, is_active? }
//
// Inserts an append-only row in shuttle_pings. /track polls /current to read
// the most recent row. is_active=false signals "off duty" (driver tapped End
// route) so the public map can fade out the marker without deleting history.
export async function POST(req) {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return Response.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
  }
  if (!isDriver(user.email)) {
    return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
  }

  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ ok: false, reason: 'bad_coords' }, { status: 400 })
  }

  const row = {
    lat,
    lng,
    speed_mph: Number.isFinite(Number(body.speed)) ? Number(body.speed) : null,
    heading: Number.isFinite(Number(body.heading)) ? Number(body.heading) : null,
    is_active: body.is_active === false ? false : true,
    group_id: body.group_id || null,
  }

  const admin = supabaseAdmin()
  const { error } = await admin.from('shuttle_pings').insert(row)
  if (error) {
    return Response.json({ ok: false, reason: 'db_error', detail: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
