import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isDriver } from '@/lib/roles'
import { isLoopDriver } from '@/lib/loopDriver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/shuttle/ping — driver-only.
// Body: { lat, lng, speed?, heading?, group_id?, is_active? }
//
// Two driver types share this endpoint:
//   - Brew Loop drivers: authenticated by Supabase login + isDriver(email).
//   - The Loop (Marines) drivers: code-gated (loop_driver cookie), with NO
//     Supabase session. They may ONLY ping a kind='marines' group_id, so a
//     Loop driver can't spoof a Brew Loop bus onto the public map.
//
// Inserts an append-only row in shuttle_pings. /track polls /current to read
// the most recent row. is_active=false signals "off duty".
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
  const brewDriver = !!(user && isDriver(user.email))

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

  const groupId = body.group_id || null
  const admin = supabaseAdmin()

  // Authorize. Brew Loop drivers ping any group; Loop drivers are confined to a
  // Marines group_id that they must name and that must actually be kind='marines'.
  let authed = brewDriver
  if (!authed) {
    if (await isLoopDriver()) {
      if (!groupId) {
        return Response.json({ ok: false, reason: 'group_required' }, { status: 400 })
      }
      const { data: g } = await admin.from('groups').select('kind').eq('id', groupId).maybeSingle()
      if (g?.kind === 'marines') authed = true
    }
  }
  if (!authed) {
    if (!user) return Response.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
    return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  }

  const row = {
    lat,
    lng,
    speed_mph: Number.isFinite(Number(body.speed)) ? Number(body.speed) : null,
    heading: Number.isFinite(Number(body.heading)) ? Number(body.heading) : null,
    is_active: body.is_active === false ? false : true,
    group_id: groupId,
  }

  const { error } = await admin.from('shuttle_pings').insert(row)
  if (error) {
    return Response.json({ ok: false, reason: 'db_error', detail: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
