import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLeadership } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/shuttle/debug — leadership-only.
// Dumps the last 10 shuttle_pings rows with computed age + freshness so we can
// confirm the driver pipeline is actually inserting rows. Hit this from a
// browser when /track shows nothing to localize whether the bug is on the
// driver-write side or the rider-read side.
export async function GET() {
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
  if (!isLeadership(user.email)) {
    return Response.json({ ok: false, reason: 'forbidden', email: user.email }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shuttle_pings')
    .select('id, group_id, lat, lng, speed_mph, heading, is_active, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(10)

  if (error) {
    return Response.json({ ok: false, reason: 'db_error', detail: error.message }, { status: 500 })
  }

  const now = Date.now()
  const rows = (data || []).map(r => {
    const ageMs = now - new Date(r.recorded_at).getTime()
    return {
      ...r,
      age_seconds: Math.floor(ageMs / 1000),
      age_pretty: prettyAge(ageMs),
      stale: ageMs > 5 * 60 * 1000,
    }
  })

  const latest = rows[0] || null
  const wouldShowOnTrack = !!(latest && latest.is_active && !latest.stale)

  return Response.json({
    ok: true,
    viewer: user.email,
    total_returned: rows.length,
    latest_summary: latest
      ? {
          recorded_at: latest.recorded_at,
          age: latest.age_pretty,
          is_active: latest.is_active,
          stale: latest.stale,
          would_show_on_track: wouldShowOnTrack,
          why_hidden: wouldShowOnTrack
            ? null
            : !latest.is_active
              ? 'most recent ping has is_active=false (driver tapped End route)'
              : 'most recent ping is older than 5 minutes',
        }
      : { note: 'shuttle_pings table is empty — no driver has ever pinged' },
    rows,
  })
}

function prettyAge(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}
