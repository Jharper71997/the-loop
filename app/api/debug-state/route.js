import { denyIfNotLeadership } from '@/lib/routeAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Authorize in-route rather than trusting the middleware path prefix.
// Dumps contact counts and every group row.
// Middleware is a single regex away from not covering this path, and the
// handler below uses the service role, so it must not be the only gate.
export async function GET() {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const supabase = supabaseAdmin()

  const [contacts, groups, members] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase.from('groups').select('*'),
    supabase.from('group_members').select('id', { count: 'exact', head: true }),
  ])

  return Response.json({
    counts: {
      contacts: contacts.count,
      groups: groups.data?.length,
      group_members: members.count,
    },
    groups: (groups.data || []).map(g => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      tt_event_id: g.tt_event_id,
      event_date: g.event_date,
      pickup_time: g.pickup_time,
      has_schedule: Array.isArray(g.schedule) && g.schedule.length > 0,
    })),
  })
}
