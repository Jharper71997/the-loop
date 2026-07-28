import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotCron } from '@/lib/cronAuth'
import { todayInTZ } from '@/lib/schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Daily auto close-out of finished Loops.
//
// A Loop stays on the admin Tonight/Schedule, driver, tickets, waivers and
// messaging screens until its `closed_out_at` is stamped. This used to rely on
// staff pressing "Close out loop" by hand, which let finished Loops pile up as
// "in progress" — and made it easy to misclick a future Loop closed. This cron
// runs at ~4 AM Eastern and closes out any open Loop whose night has already
// passed, so last night's Loop drops off on its own the next morning while
// tonight's / upcoming Loops are left untouched.
//
// "Passed" = event_date strictly before today's Eastern date. At 4 AM ET a Loop
// from the night before reads as yesterday's date and gets closed; a Loop dated
// today (still upcoming that evening) does not. The 4 AM run is safely after
// Loops end (~2 AM), so it never closes one mid-ride. Loops with no date are
// left alone (NULL fails the < comparison).
//
// Scoped to kind = 'brew' for now; Marines / Surf run their own admin surfaces.
//
// Auth: CRON_SECRET via constant-time Bearer compare (lib/cronAuth).

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const supabase = supabaseAdmin()
  const today = todayInTZ() // Eastern 'YYYY-MM-DD'

  const { data, error } = await supabase
    .from('groups')
    .update({ closed_out_at: new Date().toISOString() })
    .eq('kind', 'brew')
    .is('closed_out_at', null)
    .lt('event_date', today)
    .select('id, event_date, name')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    today,
    closed: data?.length || 0,
    ids: (data || []).map(g => g.id),
  })
}
