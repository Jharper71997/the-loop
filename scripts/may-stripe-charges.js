// Scan ALL Stripe charges in the May window (incl. lump-sum / payment-link /
// invoice charges that aren't per-rider checkout sessions) to find group payments
// like the bachelorette + Thursday run. Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const GTE = Math.floor(new Date('2026-04-20T00:00:00-05:00').getTime()/1000)
const LTE = Math.floor(new Date('2026-06-03T23:59:59-05:00').getTime()/1000)

async function main() {
  const charges = []
  let starting_after
  for (;;) {
    const page = await stripe.charges.list({ limit: 100, created: { gte: GTE, lte: LTE }, ...(starting_after?{starting_after}:{}) })
    charges.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length-1].id
  }
  const ok = charges.filter(c => c.paid && c.status === 'succeeded')
  console.log(`Charges in window: ${charges.length} | succeeded: ${ok.length}`)
  console.log(`\ndate       amount  buyer / description / source`)
  for (const c of ok.sort((a,b)=>a.created-b.created)) {
    const date = new Date(c.created*1000).toISOString().slice(0,10)
    const who = c.billing_details?.name || c.metadata?.buyer_name || ''
    const desc = c.description || c.calculated_statement_descriptor || ''
    const viaSession = c.metadata?.order_id ? 'checkout' : (c.payment_intent ? 'PI/'+(c.invoice?'invoice':'link/manual') : 'manual')
    // Flag likely group/lump-sum payments (> $80)
    const flag = (c.amount/100) >= 80 ? '  <== LUMP?' : ''
    console.log(`${date} $${String((c.amount/100).toFixed(2)).padStart(7)}  ${(who||'(no name)').padEnd(20)} | ${desc.slice(0,40).padEnd(40)} | ${viaSession}${flag}`)
  }
}
main().catch(e=>{console.error(e);process.exit(1)})
