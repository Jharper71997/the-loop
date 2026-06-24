import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isSurfAdmin } from '@/lib/surfAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/surf-admin/revenue — code-gated. Surf City Loop sales only.
// The metadata->>kind='surf' filter is what keeps Surf revenue separate from
// Brew Loop / Marines everywhere — checkout stamps it on every Surf order.
// Returns the Single/Day split + ride count + revenue (amount actually
// collected, so a $0 comp doesn't inflate the dollars).
export async function GET() {
  if (!(await isSurfAdmin())) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const sb = supabaseAdmin()

  const { data: orders, error } = await sb
    .from('orders')
    .select('id, total_cents, metadata, paid_at')
    .eq('status', 'paid')
    .eq('metadata->>kind', 'surf')
    .is('refunded_at', null)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const orderIds = (orders || []).map(o => o.id)

  let single = 0, day = 0, other = 0
  if (orderIds.length) {
    const { data: items } = await sb
      .from('order_items')
      .select('unit_price_cents, ticket_type:ticket_types(name)')
      .in('order_id', orderIds)
      .is('voided_at', null)
    for (const it of items || []) {
      const name = String(it.ticket_type?.name || '')
      if (/day\s*pass/i.test(name)) day++
      else if (/single/i.test(name)) single++
      else other++
    }
  }

  // Revenue = what was actually collected (webhook stamps amount_collected_cents);
  // fall back to total_cents for orders that predate that field.
  let revenueCents = 0
  let comps = 0
  for (const o of orders || []) {
    const collected = Number.isInteger(o.metadata?.amount_collected_cents)
      ? o.metadata.amount_collected_cents
      : (o.total_cents || 0)
    revenueCents += collected
    if (collected === 0) comps++
  }

  return Response.json({
    rides: single + day + other,
    single,
    day,
    other,
    comps,
    revenue_cents: revenueCents,
    orders: orderIds.length,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
