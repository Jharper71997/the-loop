import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isDriver } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/driver/log-stop — driver-only.
// Body: { stop_id, actual_arrival_at?, riders_on?, riders_off?, riders_remaining?, notes? }
//
// Auth pattern mirrors /api/shuttle/ping. logged_by_email comes from the
// authenticated session, never from the body.
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

  const stopId = body?.stop_id
  if (!stopId) {
    return Response.json({ ok: false, reason: 'stop_id_required' }, { status: 400 })
  }

  const update = {
    actual_arrival_at: body.actual_arrival_at
      ? toIsoOrNull(body.actual_arrival_at)
      : new Date().toISOString(),
    riders_on: nonNegIntOrNull(body.riders_on),
    riders_off: nonNegIntOrNull(body.riders_off),
    riders_remaining: nonNegIntOrNull(body.riders_remaining),
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    logged_by_email: user.email || null,
    logged_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('route_stop_logs')
    .update(update)
    .eq('id', stopId)
    .select('*')
    .maybeSingle()

  if (error) {
    return Response.json({ ok: false, reason: 'db_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ ok: false, reason: 'stop_not_found' }, { status: 404 })
  }

  return Response.json({ ok: true, stop: data })
}

function nonNegIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

function toIsoOrNull(v) {
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}
