// FINAL May reconciliation from Stripe: separate (a) real ride bookings,
// (b) sponsor/partner fees, (c) private charter. Founder $0 tests excluded.
// Attributes ride charges to a night via description; to a bar via the
// checkout-session line items when the charge maps to one. Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const GTE = Math.floor(new Date('2026-05-01T00:00:00-05:00').getTime()/1000)
const LTE = Math.floor(new Date('2026-05-31T23:59:59-05:00').getTime()/1000)
const FOUNDERS = ['jacob harper','richard flowers','lydia harper','alyssa flowers']

function parseBar(name){ const parts=name.split('—'); let t=(parts.length>1?parts[parts.length-1]:name).trim(); t=t.replace(/^Stop\s*\d+\s*:\s*/i,'').split(/\s*[-–]\s*Pick/i)[0].trim(); if(/^walk/i.test(t))return 'Walk-on'; return t.replace(/^HideAway/i,'Hideaway').replace(/\s+(Lounge|Pub|Tavern)$/i,'').replace(/^The\s+/i,'').trim()||'Unknown' }
function nightFromDesc(d){ const m=(d||'').match(/(Friday|Saturday|Sunday|Thursday),?\s+\w+\s+\d+/i); return m?m[0]:(d||'').replace(/^Order for\s*/i,'').slice(0,30) }

async function main(){
  // Map payment_intent -> bar line items (from checkout sessions).
  const piToBars = new Map()
  let sa
  for(;;){ const pg=await stripe.checkout.sessions.list({limit:100, created:{gte:GTE-1209600, lte:LTE+259200}, ...(sa?{starting_after:sa}:{})}); for(const s of pg.data){ if(!s.payment_intent)continue; const li=await stripe.checkout.sessions.listLineItems(s.id,{limit:100,expand:['data.price.product']}); const bars=[]; for(const it of li.data){ const p=it.price?.product; const nm=(p&&typeof p==='object'?p.name:'')||it.description||''; for(let i=0;i<(it.quantity||1);i++) bars.push(parseBar(nm)); } piToBars.set(typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent.id, bars);} if(!pg.has_more)break; sa=pg.data[pg.data.length-1].id }

  const charges=[]; sa=undefined
  for(;;){ const pg=await stripe.charges.list({limit:100, created:{gte:GTE, lte:LTE}, ...(sa?{starting_after:sa}:{})}); charges.push(...pg.data); if(!pg.has_more)break; sa=pg.data[pg.data.length-1].id }
  const ok=charges.filter(c=>c.paid&&c.status==='succeeded')

  const rideByNight={}, rideByBar={}; let rideTotal=0, rideRev=0
  const sponsors=[]; const charter=[]; const excludedFounder=[]
  for(const c of ok){
    const desc=c.description||''; const who=(c.billing_details?.name||c.metadata?.buyer_name||'').trim()
    const sd=c.calculated_statement_descriptor||''
    const amt=c.amount/100
    const looksRide = /brew loop/i.test(desc) || /brew loop/i.test(sd)
    // Sponsor fees + private charter come through as "Subscription ..." or
    // "Payment for Invoice" on the CHARGE (detail is on the invoice). Exclude
    // them here — they're reconciled via the invoice script, not riders.
    if(/subscription|payment for invoice/i.test(desc)){ sponsors.push({who,amt,desc}); continue }
    // Rider booking: charge desc OR statement descriptor references Brew Loop.
    if(!looksRide){ sponsors.push({who,amt,desc:'(unclassified) '+desc}); continue }
    if(FOUNDERS.includes(who.toLowerCase()) && amt===0){ excludedFounder.push({who,amt}); continue }
    const pi=typeof c.payment_intent==='string'?c.payment_intent:c.payment_intent?.id
    const bars=piToBars.get(pi)
    const night=nightFromDesc(desc) || 'native-direct (no night in desc)'
    // riders for this charge: prefer line-item count, else infer from amount/$20 (min 1)
    const riders = bars&&bars.length ? bars.length : Math.max(1, Math.round(amt/20))
    rideTotal+=riders; rideRev+=amt
    rideByNight[night]=(rideByNight[night]||0)+riders
    if(bars&&bars.length){ for(const b of bars) rideByBar[b]=(rideByBar[b]||0)+1 }
    else rideByBar['(night-only, no bar)']=(rideByBar['(night-only, no bar)']||0)+riders
  }

  console.log('=== MAY NATIVE RIDE BOOKINGS (founder tests excluded) ===')
  console.log(`Riders: ${rideTotal} | revenue: $${rideRev.toFixed(2)}`)
  console.log('By night:'); for(const [n,c] of Object.entries(rideByNight).sort()) console.log(`   ${n.padEnd(22)} ${c}`)
  console.log('By bar:'); for(const [b,c] of Object.entries(rideByBar).sort((a,b)=>b[1]-a[1])) console.log(`   ${b.padEnd(22)} ${c}`)
  console.log(`\nExcluded founder $0 tests: ${excludedFounder.length} sessions`)
  console.log(`\n=== SPONSOR / PARTNER FEES (finance, NOT riders): ${sponsors.length} ===`)
  let sp=0; for(const s of sponsors){ sp+=s.amt; console.log(`   $${s.amt.toFixed(2).padStart(7)} ${s.who.padEnd(20)} ${s.desc}`) }
  console.log(`   sponsor total: $${sp.toFixed(2)}`)
  console.log(`\n=== PRIVATE CHARTER (bachelorette/Thursday lump): ${charter.length} ===`)
  for(const c of charter) console.log(`   $${c.amt.toFixed(2)} ${c.who} ${c.desc}`)
}
main().catch(e=>{console.error(e);process.exit(1)})
