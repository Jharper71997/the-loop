// What referral / attribution tags rode along with May bookings?
// Stripe: checkout session metadata (qr_code = bartender slug, utm_source/medium/campaign).
// Prints every tagged session + a tally. Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const GTE = Math.floor(new Date('2026-05-01T00:00:00-05:00').getTime() / 1000)
const LTE = Math.floor(new Date('2026-05-31T23:59:59-05:00').getTime() / 1000)

async function main() {
  const sessions = []; let sa
  for (;;) { const pg = await stripe.checkout.sessions.list({ limit: 100, created: { gte: GTE, lte: LTE }, ...(sa ? { starting_after: sa } : {}) }); sessions.push(...pg.data); if (!pg.has_more) break; sa = pg.data[pg.data.length - 1].id }
  const paid = sessions.filter(s => s.payment_status === 'paid' || s.status === 'complete')
  console.log(`May paid/complete sessions: ${paid.length}`)
  const qr = {}, src = {}, camp = {}, med = {}
  let tagged = 0, promo = 0
  console.log('\nTagged sessions:')
  for (const s of paid) {
    const m = s.metadata || {}
    const hasTag = m.qr_code || m.utm_source || m.utm_campaign || m.utm_medium
    if (s.total_details?.amount_discount) promo++
    if (!hasTag) continue
    tagged++
    if (m.qr_code) qr[m.qr_code] = (qr[m.qr_code] || 0) + 1
    if (m.utm_source) src[m.utm_source] = (src[m.utm_source] || 0) + 1
    if (m.utm_campaign) camp[m.utm_campaign] = (camp[m.utm_campaign] || 0) + 1
    if (m.utm_medium) med[m.utm_medium] = (med[m.utm_medium] || 0) + 1
    const who = s.customer_details?.name || m.buyer_name || ''
    console.log(`  ${who.padEnd(20)} qr=${m.qr_code || '-'} src=${m.utm_source || '-'} med=${m.utm_medium || '-'} camp=${m.utm_campaign || '-'}`)
  }
  const tally = (label, o) => { console.log(`\n${label}:`); const e = Object.entries(o).sort((a, b) => b[1] - a[1]); if (!e.length) console.log('   (none)'); for (const [k, v] of e) console.log(`   ${k}: ${v}`) }
  console.log(`\n=== SUMMARY === ${tagged}/${paid.length} sessions carried any referral/UTM tag; ${promo} used a promo code`)
  tally('QR / bartender code (qr_code)', qr)
  tally('utm_source', src); tally('utm_medium', med); tally('utm_campaign', camp)
}
main().catch(e => { console.error(e.message || e); process.exit(1) })
