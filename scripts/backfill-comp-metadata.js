// Backfill orders.metadata with what Stripe ACTUALLY collected (amount_total),
// the discount, and the promo code, so free/comped rides ($0 collected via a
// 100%-off code) can be separated from real paid sales. Stripe reads only;
// writes to our own orders table. Dry-run by default; pass --apply to write.
const fs = require('fs')
const path = require('path')
const env = {}
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
const SK = env.STRIPE_SECRET_KEY
const APPLY = process.argv.includes('--apply')
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function stripeGet(p) {
  const r = await fetch('https://api.stripe.com/v1/' + p, { headers: { Authorization: 'Bearer ' + SK } })
  return r.json()
}
const promoCache = new Map()
async function friendlyPromo(session) {
  const disc = Array.isArray(session.discounts) ? session.discounts[0] : null
  if (!disc) return null
  if (disc.promotion_code) {
    const id = typeof disc.promotion_code === 'string' ? disc.promotion_code : disc.promotion_code?.id
    if (id) {
      if (promoCache.has(id)) return promoCache.get(id)
      const pc = await stripeGet('promotion_codes/' + id)
      const code = pc?.code || id
      promoCache.set(id, code)
      return code
    }
  }
  if (disc.coupon) return typeof disc.coupon === 'string' ? disc.coupon : (disc.coupon?.name || disc.coupon?.id || null)
  return null
}

;(async () => {
  const { data: orders } = await sb
    .from('orders')
    .select('id, total_cents, paid_at, buyer_name, stripe_checkout_session_id, metadata')
    .eq('status', 'paid')
    .not('stripe_checkout_session_id', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(1000)

  const todo = (orders || []).filter(o => !o.metadata || o.metadata.amount_collected_cents == null)
  console.log(`Paid native orders: ${(orders || []).length} | missing capture: ${todo.length}`)

  let freeFound = 0, updated = 0
  for (const o of todo) {
    const s = await stripeGet('checkout/sessions/' + o.stripe_checkout_session_id)
    await sleep(120)
    if (s?.error) { console.log(`  ERR ${o.id.slice(0, 8)} ${s.error.message}`); continue }
    const collected = Number.isInteger(s.amount_total) ? s.amount_total : null
    const discount = s.total_details?.amount_discount ?? 0
    const promo = (discount > 0) ? await friendlyPromo(s) : null
    if (collected === 0) {
      freeFound++
      console.log(`  FREE  ${o.buyer_name || o.id.slice(0, 8)}  face $${(o.total_cents / 100).toFixed(0)}  code=${promo || '?'}  (${(o.paid_at || '').slice(0, 10)})`)
    }
    if (APPLY) {
      const meta = {
        ...(o.metadata && typeof o.metadata === 'object' ? o.metadata : {}),
        amount_collected_cents: collected,
        discount_cents: discount,
        promo_code: promo,
        comp: collected === 0,
      }
      const { error } = await sb.from('orders').update({ metadata: meta }).eq('id', o.id)
      if (error) console.log(`   update failed ${o.id.slice(0, 8)}: ${error.message}`); else updated++
    }
  }
  console.log(`\nFree/comped orders found: ${freeFound}`)
  console.log(APPLY ? `Applied metadata to ${updated} order(s).` : `Dry run — re-run with --apply to write.`)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
