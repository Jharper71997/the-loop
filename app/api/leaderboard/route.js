import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TT_BASE = 'https://api.tickettailor.com/v1'
const CACHE_TTL_MS = 5 * 60 * 1000

let cache = { key: null, data: null, at: 0 }

// GET /api/leaderboard
// Aggregates the current calendar month of completed Ticket Tailor orders by
// referral_tag, joins display_name + bar from the `bartenders` table, returns
// a ranked standings list. 5-minute in-memory cache (per process) so phone
// refreshes don't hammer the TT API.
//
// ?fresh=1 bypasses the cache. Used by the admin panel right after an
// Add/Edit/Delete/Toggle so deletions show up immediately instead of 5 min
// later.
export async function GET(req) {
  const url = new URL(req.url)
  const fresh = url.searchParams.get('fresh') === '1'

  const now = new Date()
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  if (!fresh && cache.key === monthKey && cache.data && (Date.now() - cache.at) < CACHE_TTL_MS) {
    return Response.json(cache.data)
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const monthStartUnix = Math.floor(monthStart.getTime() / 1000)

  const supabase = supabaseAdmin()
  const [bartendersRes, orders] = await Promise.all([
    supabase.from('bartenders').select('slug, display_name, bar, active, share_code'),
    fetchAllOrdersSince(monthStartUnix),
  ])

  const bartenders = bartendersRes.data || []
  const bartenderBySlug = new Map(bartenders.map(b => [b.slug, b]))
  // Lowercased share_code → bartender, so a customer-typed code at TT
  // checkout (case-insensitive) can be resolved back to a slug.
  const bartenderByShareCode = new Map(
    bartenders
      .filter(b => b.share_code)
      .map(b => [String(b.share_code).toLowerCase(), b]),
  )

  // Aggregate ticket count + revenue. An order is credited to the bartender
  // whose slug matches `referral_tag` (URL-attribution), OR — if there's no
  // referral_tag — whose `share_code` matches the voucher code applied at TT
  // checkout. referral_tag wins when both are present (it's the more specific
  // signal: the customer actually used that bartender's URL).
  const agg = new Map()
  for (const order of orders) {
    let bartender = null
    if (order.referral_tag) {
      bartender = bartenderBySlug.get(order.referral_tag) || null
    }
    if (!bartender) {
      const code = orderVoucherCode(order)
      if (code) {
        bartender = bartenderByShareCode.get(code.toLowerCase()) || null
      }
    }
    if (!bartender || !bartender.active) continue

    let row = agg.get(bartender.slug)
    if (!row) {
      row = {
        slug: bartender.slug,
        name: bartender.display_name,
        bar: bartender.bar,
        tickets: 0,
        revenue_cents: 0,
      }
      agg.set(bartender.slug, row)
    }

    for (const li of (order.line_items || [])) {
      if (li.type !== 'ticket') continue
      row.tickets += Number(li.quantity || 0)
    }
    row.revenue_cents += Number(order.total || 0)
  }

  const standings = Array.from(agg.values())
    .map(r => ({ ...r, qualifies: r.tickets >= 10 }))
    .sort((a, b) => b.tickets - a.tickets || b.revenue_cents - a.revenue_cents)

  // Include zero-ticket signups so bartenders see themselves on the board.
  const seen = new Set(standings.map(s => s.slug))
  for (const b of bartenders) {
    if (!b.active || seen.has(b.slug)) continue
    standings.push({
      slug: b.slug,
      name: b.display_name,
      bar: b.bar,
      tickets: 0,
      revenue_cents: 0,
      qualifies: false,
    })
  }

  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
  const daysRemaining = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / 86400000))

  const data = {
    month: now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    days_remaining: daysRemaining,
    standings,
    updated_at: new Date().toISOString(),
  }

  cache = { key: monthKey, data, at: Date.now() }
  return Response.json(data)
}

async function fetchAllOrdersSince(unixSeconds) {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return []

  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
  const all = []
  let endingBefore = null
  // Walk back from newest. TT's "starting_after" / "ending_before" are cursor-
  // based; passing a very large ending_before sentinel returns the newest page.
  let cursor = endingBefore || 'or_2147483647'

  for (let page = 0; page < 20; page++) {
    const url = new URL(`${TT_BASE}/orders`)
    url.searchParams.set('status', 'completed')
    url.searchParams.set('created_at_gte', String(unixSeconds))
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('ending_before', cursor)

    const res = await fetch(url.toString(), {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (!res.ok) break

    const payload = await res.json().catch(() => null)
    const data = payload?.data || []
    if (!data.length) break

    all.push(...data)

    // Oldest order on this page becomes the next ending_before cursor.
    const oldest = data[data.length - 1]
    if (!oldest?.id) break
    cursor = oldest.id

    if (data.length < 100) break
  }
  return all
}

// Pull the voucher / discount code applied to a TT order, if any. TT's API
// has historically used a few different field names for this, depending on
// whether it's a voucher (gift-card-like) or a percentage discount. Try the
// common shapes and return the first non-empty code found. Returns null if
// the order didn't apply any code.
function orderVoucherCode(order) {
  if (!order) return null
  // Voucher applied at checkout — gift-card / promo credit shape.
  const voucher = order.voucher || order.applied_voucher
  if (typeof voucher === 'string' && voucher.trim()) return voucher.trim()
  if (voucher && typeof voucher.code === 'string' && voucher.code.trim()) return voucher.code.trim()
  // Discount code applied at checkout.
  const discount = order.discount || order.applied_discount
  if (typeof discount === 'string' && discount.trim()) return discount.trim()
  if (discount && typeof discount.code === 'string' && discount.code.trim()) return discount.code.trim()
  // Some TT order payloads expose an array of codes under `applied_vouchers`
  // or `vouchers`. Take the first one's code.
  const arr = order.applied_vouchers || order.vouchers || order.discounts
  if (Array.isArray(arr) && arr.length) {
    const first = arr[0]
    if (typeof first === 'string' && first.trim()) return first.trim()
    if (first && typeof first.code === 'string' && first.code.trim()) return first.code.trim()
  }
  return null
}
