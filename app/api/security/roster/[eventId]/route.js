import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { canCheckIn } from '@/lib/roles'
import { contactHasSignedCurrent } from '@/lib/waiver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/security/roster/<eventId>
// Door list for an event: every paid, non-voided rider with their waiver +
// check-in status. The /security/door-list page polls this so the screen
// stays fresh while staff are scanning.
export async function GET(req, ctx) {
  const { eventId } = await ctx.params
  if (!eventId) return Response.json({ error: 'missing_event_id' }, { status: 400 })

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

  const { data: event } = await admin
    .from('events')
    .select('id, name, event_date, pickup_time, status, group:groups ( id, schedule )')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return Response.json({ error: 'unknown_event' }, { status: 404 })

  const { data: items, error } = await admin
    .from('order_items')
    .select(`
      id, rider_first_name, rider_last_name, contact_id,
      checked_in_at, checked_in_via, voided_at,
      claim_token, claimed_at,
      order:orders!inner ( id, status, buyer_name, buyer_phone, event_id )
    `)
    .eq('order.event_id', eventId)
    .eq('order.status', 'paid')
    .is('voided_at', null)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Collect QR codes per item so the door list can fall back to launching
  // /tickets/<code> if security wants to confirm a face/photo before manual
  // check-in. Skip unclaimed claim-link seats (no real rider yet).
  const itemIds = (items || []).filter(i => !(i.claim_token && !i.claimed_at)).map(i => i.id)
  const codeByItem = {}
  if (itemIds.length) {
    const { data: qrs } = await admin
      .from('qr_codes')
      .select('order_item_id, code')
      .eq('kind', 'checkin')
      .in('order_item_id', itemIds)
    for (const q of qrs || []) codeByItem[q.order_item_id] = q.code
  }

  // Waiver lookup per distinct contact_id.
  const contactIds = Array.from(new Set((items || []).map(i => i.contact_id).filter(Boolean)))
  const waiverByContact = {}
  for (const cid of contactIds) {
    waiverByContact[cid] = await contactHasSignedCurrent(admin, cid)
  }

  const riders = (items || []).map(i => {
    const unclaimed = !!(i.claim_token && !i.claimed_at)
    const fullName = unclaimed
      ? null
      : [i.rider_first_name, i.rider_last_name].filter(Boolean).join(' ') || null
    return {
      order_item_id: i.id,
      first_name: unclaimed ? null : (i.rider_first_name || null),
      last_name: unclaimed ? null : (i.rider_last_name || null),
      full_name: fullName,
      buyer_name: i.order?.buyer_name || null,
      buyer_phone: i.order?.buyer_phone || null,
      waiver_signed: i.contact_id ? !!waiverByContact[i.contact_id] : false,
      checked_in_at: i.checked_in_at,
      checked_in_via: i.checked_in_via,
      ticket_code: codeByItem[i.id] || null,
      unclaimed,
    }
  })

  // Sort: not-checked-in first (alphabetical, unclaimed last), then checked-in
  // (newest scan first). Door staff care most about who's still missing.
  riders.sort((a, b) => {
    if (!!a.checked_in_at !== !!b.checked_in_at) return a.checked_in_at ? 1 : -1
    if (a.checked_in_at && b.checked_in_at) {
      return b.checked_in_at.localeCompare(a.checked_in_at)
    }
    if (a.unclaimed !== b.unclaimed) return a.unclaimed ? 1 : -1
    const an = (a.full_name || '').toLowerCase()
    const bn = (b.full_name || '').toLowerCase()
    return an.localeCompare(bn)
  })

  const paidCount = riders.length
  const checkedInCount = riders.filter(r => r.checked_in_at).length

  return Response.json({
    event: {
      id: event.id,
      name: event.name,
      event_date: event.event_date,
      pickup_time: event.group?.schedule?.[0]?.start_time || event.pickup_time,
      pickup_spot: event.group?.schedule?.[0]?.name || null,
      status: event.status,
    },
    paid_count: paidCount,
    checked_in_count: checkedInCount,
    riders,
  })
}
