import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isDriver } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/driver/route-log?event_id=... — driver-only.
// Returns the 25 pre-generated route_stop_logs rows for tonight's event,
// ordered by stop_index. Driver UI calls this on /driver to render the list.
export async function GET(req) {
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

  const url = new URL(req.url)
  const eventId = url.searchParams.get('event_id')
  if (!eventId) {
    return Response.json({ ok: false, reason: 'event_id_required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('route_stop_logs')
    .select('*')
    .eq('event_id', eventId)
    .order('stop_index', { ascending: true })

  if (error) {
    return Response.json({ ok: false, reason: 'db_error', detail: error.message }, { status: 500 })
  }
  return Response.json({ ok: true, stops: data || [] })
}
