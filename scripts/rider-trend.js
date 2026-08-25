// AUTHORITATIVE 3-month ridership recount (Mar/Apr/May 2026) from the two real
// payment processors, because the app `orders` table misses Stripe bookings that
// skip the /book flow (payment links, direct/party charges):
//
//   Ticket Tailor  -> dominant Jan..~Apr (its own checkout). Riders = valid issued
//                     tickets, bucketed by EVENT month. Read from saved MCP dumps.
//   Stripe         -> native /book + payment links + party charges, live from
//                     ~Apr 20. Riders = ride charges (sponsor/subscription fees and
//                     founder $0 tests excluded), bucketed by charge month.
//
// The two processors barely overlap in time, so they are additive. Includes the
// 17-person booked party (a Stripe party charge). Writes JSON + HTML chart to Desktop.
const fs = require('fs'), path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const l of envText.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']
const MONTHS = ['2026-03', '2026-04', '2026-05']
const LABEL = { '2026-03': 'Mar', '2026-04': 'Apr', '2026-05': 'May' }
const ym = unix => new Date(unix * 1000).toISOString().slice(0, 7)

// ---- Ticket Tailor: valid issued tickets by event month, from saved dumps ----
const TT_DUMPS = [
  'C:/Users/jacob/.claude/projects/C--Users-jacob/210d63cd-156a-4777-a9f8-d22f0d59a9cd/tool-results/mcp-claude_ai_Ticket_Tailor-orders_get-1777943653713.txt',
  'C:/Users/jacob/.claude/projects/C--Users-jacob/de71a3cb-bfcc-460f-9eb5-7838648d3bba/tool-results/mcp-claude_ai_Ticket_Tailor-orders_get-1778182485064.txt',
  'C:/Users/jacob/.claude/projects/C--Users-jacob/6b9b2596-99b5-48cd-80c3-f7fcd2b0e0ab/tool-results/mcp-claude_ai_Ticket_Tailor-orders_get-1780512539815.txt',
]
function deepOrders(txt) {
  let root; try { root = JSON.parse(txt) } catch (e) { root = JSON.parse(txt.slice(txt.search(/[\[{]/))) }
  const out = []; const visit = n => {
    if (!n) return; if (Array.isArray(n)) { n.forEach(visit); return }
    if (typeof n === 'object') {
      if (n.issued_tickets || n.buyer_details) { out.push(n); return }
      if (typeof n.text === 'string') { try { visit(JSON.parse(n.text)) } catch (e) {} }
      if (n.data) visit(n.data); for (const k of Object.keys(n)) if (typeof n[k] === 'object') visit(n[k])
    }
  }; visit(root); return out
}
function ttByMonth() {
  const byId = new Map()
  for (const f of TT_DUMPS) { try { for (const o of deepOrders(fs.readFileSync(f, 'utf8'))) byId.set(o.id, o) } catch (e) {} }
  const out = { '2026-03': 0, '2026-04': 0, '2026-05': 0 }
  for (const o of byId.values()) {
    if (o.status === 'cancelled') continue
    const d = o.event_summary && o.event_summary.start_date && o.event_summary.start_date.date
    const m = d ? d.slice(0, 7) : null
    if (!(m in out)) continue
    for (const it of (o.issued_tickets || [])) if (!it.voided_at && it.status === 'valid') out[m]++
  }
  return out
}

// ---- Stripe: ride riders by charge month ----
async function stripeByMonth() {
  const GTE = Math.floor(new Date('2026-03-01T00:00:00-05:00').getTime() / 1000)
  const LTE = Math.floor(new Date('2026-05-31T23:59:59-05:00').getTime() / 1000)
  // payment_intent -> rider line-item count (from checkout sessions)
  const piRiders = new Map(); let sa
  for (;;) {
    const pg = await stripe.checkout.sessions.list({ limit: 100, created: { gte: GTE - 1209600, lte: LTE + 259200 }, ...(sa ? { starting_after: sa } : {}) })
    for (const s of pg.data) {
      if (!s.payment_intent) continue
      const li = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100 })
      let n = 0; for (const it of li.data) n += (it.quantity || 1)
      piRiders.set(typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent.id, n)
    }
    if (!pg.has_more) break; sa = pg.data[pg.data.length - 1].id
  }
  const out = { '2026-03': 0, '2026-04': 0, '2026-05': 0 }; const party = []
  sa = undefined
  for (;;) {
    const pg = await stripe.charges.list({ limit: 100, created: { gte: GTE, lte: LTE }, ...(sa ? { starting_after: sa } : {}) })
    for (const c of pg.data) {
      if (!c.paid || c.status !== 'succeeded') continue
      const desc = c.description || ''; const sd = c.calculated_statement_descriptor || ''
      const who = (c.billing_details && c.billing_details.name || '').trim(); const amt = c.amount / 100
      if (/subscription|payment for invoice/i.test(desc)) continue            // sponsor/partner fee, not riders
      if (!(/brew loop/i.test(desc) || /brew loop/i.test(sd))) continue        // unclassified -> not a ride
      if (FOUNDERS.includes(who.toLowerCase()) && amt === 0) continue          // founder test
      const m = ym(c.created); if (!(m in out)) continue
      const pi = typeof c.payment_intent === 'string' ? c.payment_intent : (c.payment_intent && c.payment_intent.id)
      const riders = piRiders.get(pi) || Math.max(1, Math.round(amt / 20))
      out[m] += riders
      if (riders >= 8) party.push({ month: m, riders, who, amt })
    }
    if (!pg.has_more) break; sa = pg.data[pg.data.length - 1].id
  }
  return { out, party }
}

async function main() {
  const tt = ttByMonth()
  const { out: st, party } = await stripeByMonth()
  const rows = MONTHS.map(m => ({ month: m, label: LABEL[m], tt: tt[m], stripe: st[m], total: tt[m] + st[m] }))
  console.log('month  TicketTailor  Stripe  TOTAL')
  for (const r of rows) console.log(`${r.label}      ${String(r.tt).padStart(3)}        ${String(r.stripe).padStart(3)}    ${r.total}`)
  console.log('\nLarge/party charges (>=8 riders) detected in Stripe:')
  for (const p of party) console.log(`  ${p.month}  ${p.riders} riders  $${p.amt}  ${p.who || '(no name)'}`)
  console.log('\nNOTE: TT = valid issued tickets by event date; Stripe = ride charges by charge date.')
  console.log('Walk-ons not in TT presold and invoice-paid charters are NOT included here.')

  const J = o => JSON.stringify(o)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Jville Brew Loop - Ridership, Mar-May 2026</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0a0a0b;--card:#141417;--gold:#d4a333;--ink:#f4f0e6;--mut:#8a8578;--line:#26241e;--cyan:#3fb0c8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:28px}
h1{font-size:24px;margin:0 0 2px}.sub{color:var(--mut);margin:0 0 24px;font-size:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1100px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
.card.wide{grid-column:1/-1}
.card h2{font-size:15px;margin:0 0 14px;color:var(--gold);letter-spacing:.04em;text-transform:uppercase;font-weight:600}
.kpis{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:22px;max-width:1100px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;flex:1;min-width:150px}
.kpi .n{font-size:30px;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}
.kpi .l{color:var(--mut);font-size:13px;margin-top:2px}
.note{color:var(--mut);font-size:12.5px;max-width:1100px;margin-top:18px;line-height:1.6}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{color:var(--gold);font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:8px}
canvas{max-height:300px}
</style></head><body>
<h1>Jville Brew Loop - Ridership Trend</h1>
<p class="sub">Riders per month, March-May 2026 - counted from both processors: Ticket Tailor + Stripe</p>
<div class="kpis">
  <div class="kpi"><div class="n">${rows.reduce((s, r) => s + r.total, 0)}</div><div class="l">Total riders, Mar-May</div></div>
  <div class="kpi"><div class="n">${rows[0].total} &rarr; ${rows.at(-1).total}</div><div class="l">Mar to May (${rows[0].total ? (rows.at(-1).total >= rows[0].total ? '+' : '') + Math.round((rows.at(-1).total / rows[0].total - 1) * 100) + '%' : 'n/a'})</div></div>
  <div class="kpi"><div class="n">${rows.at(-1).total}</div><div class="l">May riders</div></div>
  <div class="kpi"><div class="n">${rows.at(-1).stripe}</div><div class="l">May on Stripe (incl. party)</div></div>
</div>
<div class="grid">
  <div class="card wide"><h2>Riders per month</h2>
    <table><thead><tr><th style="text-align:left">Month</th><th style="text-align:right">Ticket Tailor</th><th style="text-align:right">Stripe</th><th style="text-align:right">Total riders</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td style="color:var(--ink);font-weight:600">${r.label}</td><td style="text-align:right;color:var(--mut)">${r.tt}</td><td style="text-align:right;color:var(--mut)">${r.stripe}</td><td style="text-align:right;color:var(--gold);font-weight:700;font-size:17px">${r.total}</td></tr>`).join('')}
    </tbody></table></div>
  <div class="card wide"><h2>Total riders per month (by source)</h2><canvas id="c1"></canvas></div>
  <div class="card"><h2>Riders - trend line</h2><canvas id="c3"></canvas></div>
  <div class="card"><h2>New vs recurring</h2><div style="color:var(--mut);font-size:13.5px;line-height:1.65">Not chartable for Mar-May: the Ticket Tailor records that cover Jan-April have rider names and emails redacted (<code style="color:var(--gold)">"**** ****"</code>), so there's no identity to tell repeat riders apart. Real rider identities only begin in <b style="color:var(--ink)">May</b> (Stripe /book). New-vs-returning becomes trackable <b style="color:var(--ink)">going forward</b>.</div></div>
</div>
<p class="note"><b>How this is counted:</b> Ticket Tailor riders = valid issued tickets by the night ridden; Stripe riders = ride charges (sponsor/subscription fees and founder $0 tests excluded) by charge date, which includes the 17-person booked party. Ticket Tailor was the checkout through ~April; Stripe /book went live ~Apr 20, so the mix shifts to Stripe in May. <b>Still excluded</b> (no clean source): unattributed walk-ons and any charter paid by Stripe <i>invoice</i> rather than a charge. Tell me the walk-on / extra-charter counts and I'll fold them in.</p>
<script>
const L=${J(rows.map(r => r.label))};
const C={gold:'#d4a333',gold2:'#8a6a1f',cyan:'#3fb0c8',mut:'#8a8578',grid:'#26241e',ink:'#f4f0e6'};
Chart.defaults.color=C.mut;Chart.defaults.font.family='Segoe UI,sans-serif';
const gx={grid:{color:C.grid},ticks:{color:C.mut}};
const totals=${J(rows.map(r => r.total))};
const barTotals={id:'bt',afterDatasetsDraw(ch){const x=ch.ctx;x.save();x.font='700 14px Segoe UI';x.fillStyle=C.ink;x.textAlign='center';x.textBaseline='bottom';const top=ch.getDatasetMeta(1);top.data.forEach((el,i)=>{x.fillText(totals[i],el.x,el.y-6)});x.font='600 12px Segoe UI';x.fillStyle='#0a0a0b';x.textBaseline='middle';ch.data.datasets.forEach((ds,di)=>{const meta=ch.getDatasetMeta(di);meta.data.forEach((el,i)=>{const v=ds.data[i];if(v>0)x.fillText(v,el.x,(el.y+el.base)/2)})});x.restore()}};
const lineVals={id:'lv',afterDatasetsDraw(ch){const x=ch.ctx;x.save();x.font='700 13px Segoe UI';x.fillStyle=C.ink;x.textAlign='center';x.textBaseline='bottom';ch.getDatasetMeta(0).data.forEach((el,i)=>x.fillText(totals[i],el.x,el.y-9));x.restore()}};
new Chart(c1,{type:'bar',plugins:[barTotals],data:{labels:L,datasets:[
 {label:'Ticket Tailor',data:${J(rows.map(r => r.tt))},backgroundColor:C.gold2,stack:'s'},
 {label:'Stripe',data:${J(rows.map(r => r.stripe))},backgroundColor:C.gold,stack:'s'}]},
 options:{layout:{padding:{top:22}},plugins:{legend:{labels:{color:C.ink}}},scales:{x:{...gx,stacked:true},y:{...gx,stacked:true,beginAtZero:true}}}});
new Chart(c3,{type:'line',plugins:[lineVals],data:{labels:L,datasets:[
 {label:'Riders',data:totals,borderColor:C.gold,backgroundColor:'rgba(212,163,51,.15)',fill:true,tension:.3,pointRadius:5,pointBackgroundColor:C.gold}]},
 options:{layout:{padding:{top:22}},plugins:{legend:{display:false}},scales:{x:gx,y:{...gx,beginAtZero:true}}}});
</script></body></html>`
  const dest = 'C:/Users/jacob/OneDrive/Desktop/brew-loop-ridership-mar-may-2026.html'
  fs.writeFileSync(dest, html)
  fs.writeFileSync('C:/Users/jacob/OneDrive/Desktop/brew-loop-ridership-mar-may-2026.json', JSON.stringify(rows, null, 2))
  console.log('\nWrote chart -> ' + dest)
}
main().catch(e => { console.error('ERR', e.message); process.exit(1) })
