import { denyIfNotLeadership } from '@/lib/routeAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/seller-sales?month=YYYY-MM
// Every paid order credited to a seller in the month, with the buyer, so a
// commission payout can be checked sale by sale. Same attribution rule as
// /api/leaderboard (metadata.qr_code = seller slug). Leadership only: this
// returns buyer names and phones, which the public leaderboard never shows.
export async function GET(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const url = new URL(req.url)
  const now = new Date()
  const m = /^(\d{4})-(\d{2})$/.exec(url.searchParams.get('month') || '')
  const year = m ? Number(m[1]) : now.getUTCFullYear()
  const monthIdx = m ? Number(m[2]) - 1 : now.getUTCMonth()
  const monthStart = new Date(Date.UTC(year, monthIdx, 1))
  const monthEnd = new Date(Date.UTC(year, monthIdx + 1, 1))

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('orders')
    .select('id, paid_at, buyer_name, buyer_phone, buyer_email, total_cents, metadata, events(name, event_date), order_items(voided_at)')
    .eq('status', 'paid')
    .gte('paid_at', monthStart.toISOString())
    .lt('paid_at', monthEnd.toISOString())
    .not('metadata->>qr_code', 'is', null)
    .order('paid_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const bySeller = {}
  for (const o of data || []) {
    const slug = o.metadata.qr_code
    const collected = Number(o.metadata?.amount_collected_cents)
    ;(bySeller[slug] ||= []).push({
      id: o.id,
      paid_at: o.paid_at,
      buyer_name: o.buyer_name,
      buyer_phone: o.buyer_phone,
      buyer_email: o.buyer_email,
      event_name: o.events?.name || null,
      event_date: o.events?.event_date || null,
      tickets: (o.order_items || []).filter(oi => !oi.voided_at).length,
      collected_cents: Number.isFinite(collected) ? collected : Number(o.total_cents || 0),
    })
  }
  return Response.json({ month: monthStart.toISOString().slice(0, 7), sales: bySeller })
}
