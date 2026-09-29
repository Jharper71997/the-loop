import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 60 * 1000
// Sellers earn this share of the money actually collected on the orders they
// drove (so comps and promo-code orders pay proportionally less).
const COMMISSION_RATE = 0.2

let cache = { key: null, data: null, at: 0 }

// GET /api/leaderboard
// Ranks sellers (the `bartenders` table: bartenders and anyone else selling
// for us) by tickets sold in a calendar month. A sale is a paid app order
// whose metadata.qr_code is the seller's slug — stamped by checkout from the
// seller's ?ref= link or their typed seller code, via Stripe metadata and the
// webhook. This used to read Ticket Tailor orders, which stopped once booking
// moved to the app, so every seller sat at 0.
//
// ?month=YYYY-MM picks a past month for payouts (default: this month).
// ?fresh=1 bypasses the 60s cache; the admin panel uses it after edits.
export async function GET(req) {
  const url = new URL(req.url)
  const fresh = url.searchParams.get('fresh') === '1'

  const now = new Date()
  const m = /^(\d{4})-(\d{2})$/.exec(url.searchParams.get('month') || '')
  const year = m ? Number(m[1]) : now.getUTCFullYear()
  const monthIdx = m ? Number(m[2]) - 1 : now.getUTCMonth()
  const monthStart = new Date(Date.UTC(year, monthIdx, 1))
  const monthEnd = new Date(Date.UTC(year, monthIdx + 1, 1))
  const monthKey = monthStart.toISOString().slice(0, 7)

  if (!fresh && cache.key === monthKey && cache.data && (Date.now() - cache.at) < CACHE_TTL_MS) {
    return Response.json(cache.data)
  }

  const supabase = supabaseAdmin()
  const [bartendersRes, ordersRes] = await Promise.all([
    supabase.from('bartenders').select('slug, display_name, bar, active'),
    supabase
      .from('orders')
      .select('id, total_cents, metadata, order_items(voided_at)')
      .eq('status', 'paid')
      .gte('paid_at', monthStart.toISOString())
      .lt('paid_at', monthEnd.toISOString())
      .not('metadata->>qr_code', 'is', null),
  ])
  if (bartendersRes.error || ordersRes.error) {
    return Response.json(
      { error: (bartendersRes.error || ordersRes.error).message },
      { status: 500 },
    )
  }

  const bartenders = bartendersRes.data || []
  const bartenderBySlug = new Map(bartenders.map(b => [b.slug, b]))

  const agg = new Map()
  for (const order of ordersRes.data || []) {
    const bartender = bartenderBySlug.get(order.metadata?.qr_code)
    if (!bartender || !bartender.active) continue

    let row = agg.get(bartender.slug)
    if (!row) {
      row = { slug: bartender.slug, name: bartender.display_name, bar: bartender.bar, tickets: 0, revenue_cents: 0 }
      agg.set(bartender.slug, row)
    }
    row.tickets += (order.order_items || []).filter(oi => !oi.voided_at).length
    const collected = Number(order.metadata?.amount_collected_cents)
    row.revenue_cents += Number.isFinite(collected) ? collected : Number(order.total_cents || 0)
  }

  const standings = Array.from(agg.values())
    .map(r => ({
      ...r,
      commission_cents: Math.round(r.revenue_cents * COMMISSION_RATE),
      qualifies: r.tickets >= 10,
    }))
    .sort((a, b) => b.tickets - a.tickets || b.revenue_cents - a.revenue_cents)

  // Include zero-ticket signups so sellers see themselves on the board.
  const seen = new Set(standings.map(s => s.slug))
  for (const b of bartenders) {
    if (!b.active || seen.has(b.slug)) continue
    standings.push({
      slug: b.slug, name: b.display_name, bar: b.bar,
      tickets: 0, revenue_cents: 0, commission_cents: 0, qualifies: false,
    })
  }

  const daysRemaining = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / 86400000))

  const data = {
    month: monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    days_remaining: daysRemaining,
    commission_rate: COMMISSION_RATE,
    standings,
    updated_at: new Date().toISOString(),
  }

  cache = { key: monthKey, data, at: Date.now() }
  return Response.json(data)
}
