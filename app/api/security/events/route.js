import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { canCheckIn } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/security/events
// Returns upcoming events the door staff might need to check riders into.
// Today and the next 7 days, only on_sale or coming_soon (no drafts/cancelled).
// Each event carries paid_count + checked_in_count so the picker can show
// "12 of 18 boarded" without a second roster fetch.
export async function GET() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  if (!canCheckIn(user.email)) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: events, error } = await admin
    .from('events')
    .select('id, name, event_date, pickup_time, status, group:groups ( id, schedule )')
    .gte('event_date', today)
    .lte('event_date', horizon)
    .in('status', ['on_sale', 'coming_soon'])
    .order('event_date', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!events || events.length === 0) return Response.json({ events: [] })

  // Per-event paid + checked-in tallies. Two queries against order_items
  // joining through orders for status='paid', filtered by event_id.
  const eventIds = events.map(e => e.id)
  const { data: items } = await admin
    .from('order_items')
    .select('id, voided_at, checked_in_at, order:orders!inner ( event_id, status )')
    .in('order.event_id', eventIds)
    .eq('order.status', 'paid')
    .is('voided_at', null)

  const tally = {}
  for (const it of items || []) {
    const eid = it.order?.event_id
    if (!eid) continue
    if (!tally[eid]) tally[eid] = { paid_count: 0, checked_in_count: 0 }
    tally[eid].paid_count += 1
    if (it.checked_in_at) tally[eid].checked_in_count += 1
  }

  return Response.json({
    events: events.map(e => ({
      id: e.id,
      name: e.name,
      event_date: e.event_date,
      pickup_time: e.group?.schedule?.[0]?.start_time || e.pickup_time,
      pickup_spot: e.group?.schedule?.[0]?.name || null,
      status: e.status,
      paid_count: tally[e.id]?.paid_count || 0,
      checked_in_count: tally[e.id]?.checked_in_count || 0,
    })),
  })
}
