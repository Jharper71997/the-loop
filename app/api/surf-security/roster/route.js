import { isSurfAdmin } from '@/lib/surfAdmin'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getActiveSurfLoop } from '@/lib/surfLoop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/surf-security/roster
// Door list for the active Surf City loop: every paid, non-voided rider with
// their pass type + check-in status + whether they're currently on board.
// Code-gated (surf_admin cookie, same code as the Surf console). No event id in
// the URL — it resolves the active Surf loop itself. Surf City has no Ticket
// Tailor + no waivers.
export async function GET() {
  if (!(await isSurfAdmin())) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const loop = await getActiveSurfLoop().catch(() => null)
  if (!loop || !loop.eventId || !loop.groupId) {
    return Response.json({ event: null, total: 0, boarded: 0, missing: 0, riders: [] })
  }

  const admin = supabaseAdmin()

  const { data: items, error } = await admin
    .from('order_items')
    .select(`
      id, rider_first_name, rider_last_name, contact_id,
      checked_in_at, checked_in_via, voided_at,
      claim_token, claimed_at,
      ticket_type:ticket_types ( name ),
      order:orders!inner ( id, status, buyer_name, event_id )
    `)
    .eq('order.event_id', loop.eventId)
    .eq('order.status', 'paid')
    .is('voided_at', null)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Skip unclaimed claim-link seats (no real rider yet) when pulling QR codes.
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

  // Latest loop_boardings action per order_item → "on board now".
  const onBoardByItem = {}
  const { data: boardings } = await admin
    .from('loop_boardings')
    .select('order_item_id, action, created_at')
    .eq('group_id', loop.groupId)
    .order('created_at', { ascending: true })
  for (const b of boardings || []) {
    if (b.order_item_id) onBoardByItem[b.order_item_id] = b.action === 'board'
  }

  const riders = (items || []).map(i => {
    const unclaimed = !!(i.claim_token && !i.claimed_at)
    const name = unclaimed
      ? null
      : [i.rider_first_name, i.rider_last_name].filter(Boolean).join(' ') || null
    return {
      order_item_id: i.id,
      name,
      buyer_name: i.order?.buyer_name || null,
      pass_type: i.ticket_type?.name || 'Ride',
      ticket_code: codeByItem[i.id] || null,
      checked_in_at: i.checked_in_at,
      checked_in_via: i.checked_in_via,
      on_board: !!onBoardByItem[i.id],
      unclaimed,
    }
  })

  // Not-boarded first (alphabetical, unclaimed last), then boarded (newest scan
  // first). Door staff care most about who's still missing.
  riders.sort((a, b) => {
    if (!!a.checked_in_at !== !!b.checked_in_at) return a.checked_in_at ? 1 : -1
    if (a.checked_in_at && b.checked_in_at) return b.checked_in_at.localeCompare(a.checked_in_at)
    if (a.unclaimed !== b.unclaimed) return a.unclaimed ? 1 : -1
    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
  })

  const total = riders.length
  const boarded = riders.filter(r => r.checked_in_at).length

  return Response.json({
    event: {
      id: loop.eventId,
      name: loop.name,
      event_date: loop.eventDate,
      pickup_time: loop.pickupTime,
    },
    total,
    boarded,
    missing: total - boarded,
    riders,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
