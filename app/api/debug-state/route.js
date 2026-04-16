import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
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
      tt_event_id: g.tt_event_id,
      event_date: g.event_date,
      pickup_time: g.pickup_time,
      has_schedule: Array.isArray(g.schedule) && g.schedule.length > 0,
    })),
  })
}
