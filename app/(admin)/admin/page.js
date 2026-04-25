import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { operationalDateInTZ, nowInTZ, currentStopIndex, formatStopTime } from '@/lib/schedule'
import TonightClient from './TonightClient'

export const dynamic = 'force-dynamic'

export default async function TonightPage() {
  const supabase = supabaseAdmin()
  const today = operationalDateInTZ()
  const now = nowInTZ()

  const { data: groups } = await supabase
    .from('groups')
    .select(`
      id, name, event_date, pickup_time, schedule,
      group_members (
        id, current_stop_index,
        contacts ( id, first_name, last_name, phone, has_signed_waiver )
      )
    `)
    .is('archived_at', null)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(4)

  const todayGroup = (groups || []).find(g => g.event_date === today) || null
  const nextGroup = !todayGroup ? (groups || [])[0] || null : null

  let state = 'none'
  let activeGroup = todayGroup || nextGroup
  let currentIdx = -1

  if (todayGroup) {
    const schedule = Array.isArray(todayGroup.schedule) ? todayGroup.schedule : []
    currentIdx = currentStopIndex(schedule, now, todayGroup.event_date, today)
    state = currentIdx >= 0 && currentIdx < schedule.length ? 'in_progress' : 'pre_pickup'
  } else if (nextGroup) {
    state = 'upcoming'
  }

  const { data: ordersToday } = await supabase
    .from('orders')
    .select('id, buyer_name, total_cents, party_size, status, paid_at, metadata')
    .eq('status', 'paid')
    .gte('paid_at', `${today}T00:00:00`)
    .order('paid_at', { ascending: false })
    .limit(5)

  return (
    <TonightClient
      state={state}
      today={today}
      group={activeGroup}
      currentIdx={currentIdx}
      ordersToday={ordersToday || []}
    />
  )
}
