// EVERY Stripe charge in May 2026 — full ledger. Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const GTE = Math.floor(new Date('2026-05-01T00:00:00-05:00').getTime()/1000)
const LTE = Math.floor(new Date('2026-05-31T23:59:59-05:00').getTime()/1000)

async function main() {
  const charges = []; let starting_after
  for (;;) {
    const page = await stripe.charges.list({ limit: 100, created: { gte: GTE, lte: LTE }, expand: ['data.customer', 'data.invoice'], ...(starting_after?{starting_after}:{}) })
    charges.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length-1].id
  }
  charges.sort((a,b)=>a.created-b.created)

  const succeeded = charges.filter(c => c.status==='succeeded')
  const failed    = charges.filter(c => c.status!=='succeeded')
  let gross=0, refunded=0
  for (const c of succeeded){ gross+=c.amount; refunded+=c.amount_refunded }

  function cat(c){
    if (c.metadata?.order_id) return 'rider-checkout'
    if (c.invoice?.subscription || /subscription/i.test(c.description||'')) return 'sponsor/bar-sub'
    if (c.invoice) return 'invoice'
    if (/JVILLE BREW LOOP/i.test(c.description||c.calculated_statement_descriptor||'')) return 'rider-link'
    return 'other'
  }

  console.log(`ALL STRIPE CHARGES — May 2026`)
  console.log(`Total charge attempts: ${charges.length}  |  succeeded: ${succeeded.length}  |  failed/other: ${failed.length}`)
  console.log(`Gross succeeded: $${(gross/100).toFixed(2)}  |  refunded: $${(refunded/100).toFixed(2)}  |  net: $${((gross-refunded)/100).toFixed(2)}\n`)

  console.log(`date        amount    refund   cat              customer                          | description`)
  for (const c of succeeded){
    const date=new Date(c.created*1000).toISOString().slice(0,10)
    const who=(c.customer?.name)||c.billing_details?.name||c.metadata?.buyer_name||'(no name)'
    const desc=(c.description||c.calculated_statement_descriptor||'').slice(0,34)
    const rf=c.amount_refunded?`-$${(c.amount_refunded/100).toFixed(0)}`:''
    console.log(`${date}  $${String((c.amount/100).toFixed(2)).padStart(8)}  ${rf.padStart(6)}  ${cat(c).padEnd(15)}  ${who.slice(0,26).padEnd(26)} | ${desc}`)
  }

  // Totals by category
  const byCat={}
  for (const c of succeeded){ const k=cat(c); byCat[k]=byCat[k]||{n:0,amt:0}; byCat[k].n++; byCat[k].amt+=c.amount-c.amount_refunded }
  console.log(`\nNET BY CATEGORY:`)
  for (const [k,v] of Object.entries(byCat).sort((a,b)=>b[1].amt-a[1].amt))
    console.log(`  ${k.padEnd(16)} ${String(v.n).padStart(3)} charges   $${(v.amt/100).toFixed(2)}`)

  if (failed.length){
    console.log(`\nFAILED / NON-SUCCEEDED (${failed.length}):`)
    for (const c of failed){
      const date=new Date(c.created*1000).toISOString().slice(0,10)
      const who=(c.customer?.name)||c.billing_details?.name||'(no name)'
      console.log(`  ${date}  $${(c.amount/100).toFixed(2)}  ${c.status}  ${who} — ${c.failure_message||c.outcome?.seller_message||''}`)
    }
  }
}
main().catch(e=>{console.error(e);process.exit(1)})
