import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/contact-orders?contact_id=<uuid>
//
// Returns every order where the contact is either the buyer (orders.contact_id)
// or a rider on any item (order_items.contact_id). Uses the service-role client
// so RLS doesn't filter rows out — the contact-detail panel was returning empty
// because the browser-side anon key couldn't read orders/order_items.
export async function GET(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const url = new URL(req.url)
  const contactId = url.searchParams.get('contact_id')
  if (!contactId) return Response.json({ error: 'contact_id required' }, { status: 400 })

  const supabase = supabaseAdmin()

  const [{ data: byBuyer }, { data: itemHits }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id, status, total_cents, party_size, paid_at, created_at, stripe_payment_intent_id,
        event:events ( id, name, event_date, pickup_time ),
        order_items ( id, rider_first_name, rider_last_name, contact_id, unit_price_cents, voided_at, voided_by, void_reason )
      `)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('order_items')
      .select('order_id')
      .eq('contact_id', contactId)
      .limit(100),
  ])

  const buyerIds = new Set((byBuyer || []).map(o => o.id))
  const extraIds = (itemHits || []).map(r => r.order_id).filter(id => id && !buyerIds.has(id))
  let extra = []
  if (extraIds.length) {
    const { data } = await supabase
      .from('orders')
      .select(`
        id, status, total_cents, party_size, paid_at, created_at, stripe_payment_intent_id,
        event:events ( id, name, event_date, pickup_time ),
        order_items ( id, rider_first_name, rider_last_name, contact_id, unit_price_cents, voided_at, voided_by, void_reason )
      `)
      .in('id', extraIds)
    extra = data || []
  }

  const orders = [...(byBuyer || []), ...extra]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  return Response.json({ orders })
}
