import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { textUnsignedForGroup } from '@/lib/waiver'
import { todayInTZ } from '@/lib/schedule'
import { denyIfNotCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily morning nudge — texts every unsigned rider for tonight's Loop a link
// to /waiver/<id>. textUnsignedForGroup dedupes against the 24h SMS cooldown
// per contact, so re-running is safe. No-op when no Loop is scheduled today.
//
// Auth: CRON_SECRET via constant-time Bearer compare (lib/cronAuth).

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const supabase = supabaseAdmin()
  const today = todayInTZ()

  const { data: groups, error } = await supabase
    .from('groups')
    .select('id, name')
    .eq('event_date', today)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!groups?.length) {
    return Response.json({ ok: true, today, groups: 0, message: 'no_loop_today' })
  }

  const perGroup = []
  for (const g of groups) {
    try {
      const results = await textUnsignedForGroup(supabase, g.id)
      const sent = results.filter(r => r.sent).length
      const skipped = results.filter(r => r.skipped).length
      const errors = results.filter(r => r.error).length
      perGroup.push({ group_id: g.id, name: g.name, sent, skipped, errors })
    } catch (err) {
      perGroup.push({ group_id: g.id, name: g.name, error: err?.message || String(err) })
    }
  }

  return Response.json({ ok: true, today, groups: groups.length, per_group: perGroup })
}
