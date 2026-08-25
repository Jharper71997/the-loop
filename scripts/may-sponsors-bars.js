// Who paid in May 2026 as a sponsor / bar (recurring subs + invoices, NOT per-rider). Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const GTE = Math.floor(new Date('2026-05-01T00:00:00-05:00').getTime()/1000)
const LTE = Math.floor(new Date('2026-05-31T23:59:59-05:00').getTime()/1000)

async function main() {
  const charges = []
  let starting_after
  for (;;) {
    const page = await stripe.charges.list({ limit: 100, created: { gte: GTE, lte: LTE }, expand: ['data.customer', 'data.invoice'], ...(starting_after?{starting_after}:{}) })
    charges.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length-1].id
  }
  const ok = charges.filter(c => c.paid && c.status === 'succeeded')

  // Sponsor/bar = recurring subscription charge OR an invoice payment (charters/sponsors).
  // Exclude per-rider checkout (metadata.order_id) and one-off "JVILLE BREW LOOP" link tickets.
  const sponsorBar = ok.filter(c => {
    if (c.metadata?.order_id) return false
    const isSub = !!c.invoice?.subscription || /subscription/i.test(c.description || '')
    const isInvoice = !!c.invoice
    return isSub || isInvoice
  })

  console.log(`SPONSOR / BAR PAYMENTS — May 2026\n`)
  console.log(`date        amount    customer (name / email)                          | type`)
  let total = 0
  for (const c of sponsorBar.sort((a,b)=>a.created-b.created)) {
    const date = new Date(c.created*1000).toISOString().slice(0,10)
    const cust = c.customer
    const name = cust?.name || c.billing_details?.name || ''
    const email = cust?.email || c.billing_details?.email || c.receipt_email || ''
    const isSub = !!c.invoice?.subscription
    const type = isSub ? 'recurring sub' : 'invoice'
    total += c.amount
    console.log(`${date}  $${String((c.amount/100).toFixed(2)).padStart(8)}  ${(name||'(no name)').padEnd(22)} ${email.padEnd(34)} | ${type}`)
  }
  console.log(`\nTotal sponsor/bar collected in May: $${(total/100).toFixed(2)}  (${sponsorBar.length} payments)`)
}
main().catch(e=>{console.error(e);process.exit(1)})
