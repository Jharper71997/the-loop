// One-page INTERNAL analytics dashboard for Jville Brew Loop, straight from the
// app DB (the canonical orders/order_items tables). Aggregates all-time, by month,
// by bar, and by channel, then renders a single letter page via headless Edge.
//
//   node scripts/analytics-dashboard.js
//
// Counting rules (match may-perbar-db.js):
//   - Riders   = paid, non-voided order_items, founder $0 comps excluded.
//   - Revenue  = paid orders' total_cents, counted ONCE per order.
//   - Native   = tt_ticket_id null; TT = imported from Ticket Tailor.
//   - Charters/parties are invoiced separately and are NOT in this table — noted, not charted.
// Needs SUPABASE_SERVICE_KEY in .env.local.

const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) { console.error('SUPABASE_SERVICE_KEY not set in .env.local'); process.exit(1) }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DESKTOP = 'C:\\Users\\jacob\\OneDrive\\Desktop'
const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']
// Reconciled monthly rider truth for months the DB can't fully reproduce.
// Pre-May Ticket Tailor imports are incomplete/redacted; native /book began late Apr.
// Source: team reconciliation (matches scripts/rider-trend-pdf.js + sales-channels notes).
// individual = ticketed riders; charter = invoiced private-party riders (separate channel).
const RECON = {
  '2026-03': { individual: 39, charter: 0 },
  '2026-04': { individual: 60, charter: 14 },
  '2026-05': { individual: 64, charter: 19 },
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseBar(name) {
  if (!name) return 'Unknown'
  let t = String(name).split(/\s*[-–—]\s*Pick/i)[0].trim()
  t = t.replace(/^Stop\s*\d+\s*:\s*/i, '')
  if (/^walk/i.test(t)) return 'Walk-on'
  return t.replace(/^HideAway/i, 'Hideaway').replace(/\s+(Lounge|Pub|Tavern)$/i, '').replace(/^The\s+/i, '').trim() || 'Unknown'
}
const monthKey = d => d ? `${d.slice(0, 4)}-${d.slice(5, 7)}` : 'unknown'
const monthLabel = k => { const [y, m] = k.split('-'); return `${MONTHS[+m - 1]} ${y.slice(2)}` }
const usd = c => '$' + Math.round((c || 0) / 100).toLocaleString('en-US')

async function pageAll(build) {
  const out = []; let from = 0; const size = 1000
  for (;;) {
    const { data, error } = await build().range(from, from + size - 1)
    if (error) throw error
    out.push(...data); if (data.length < size) break; from += size
  }
  return out
}

async function main() {
  const events = await pageAll(() => sb.from('events').select('id, name, event_date'))
  const evById = new Map(events.map(e => [e.id, e]))
  const items = await pageAll(() => sb.from('order_items')
    .select('id, tt_ticket_id, voided_at, ticket_types(name), orders!inner(id, status, event_id, buyer_name, total_cents, paid_at)')
    .is('voided_at', null))
  const paid = items.filter(i => ['paid', 'completed'].includes(i.orders.status))

  const byMonth = {}      // key -> {native, tt, revenue, orders:Set, events:Set}
  const byBar = {}        // bar -> riders
  const byNight = {}      // event_date -> riders
  const seenOrder = new Set()
  let nativeTot = 0, ttTot = 0, founderTot = 0, riderTot = 0

  for (const it of paid) {
    const ev = evById.get(it.orders.event_id)
    const k = monthKey(ev?.event_date)
    const isNative = !it.tt_ticket_id
    const isFounder = isNative && FOUNDERS.includes((it.orders.buyer_name || '').trim().toLowerCase()) && (it.orders.total_cents || 0) === 0
    byMonth[k] = byMonth[k] || { native: 0, tt: 0, revenue: 0, orders: new Set(), events: new Set() }
    // revenue: once per order, on its event month
    if (!seenOrder.has(it.orders.id)) { seenOrder.add(it.orders.id); byMonth[k].revenue += (it.orders.total_cents || 0); byMonth[k].orders.add(it.orders.id) }
    if (ev) byMonth[k].events.add(ev.id)
    if (isFounder) { founderTot++; continue }
    const bar = parseBar(it.ticket_types?.name)
    byBar[bar] = (byBar[bar] || 0) + 1
    if (ev) { byNight[ev.event_date] = (byNight[ev.event_date] || 0) + 1 }
    if (isNative) { byMonth[k].native++; nativeTot++ } else { byMonth[k].tt++; ttTot++ }
    riderTot++
  }

  // Union of DB months and reconciled months; reconciled riders win where present.
  const mKeys = [...new Set([...Object.keys(byMonth).filter(k => k !== 'unknown'), ...Object.keys(RECON)])].sort()
  const months = mKeys.map(k => {
    const db = byMonth[k] || { native: 0, tt: 0, revenue: 0, orders: new Set(), events: new Set() }
    const rc = RECON[k]
    const individual = rc ? rc.individual : (db.native + db.tt)
    const charter = rc ? rc.charter : 0
    return {
      key: k, label: monthLabel(k), individual, charter, riders: individual + charter,
      native: db.native, tt: db.tt, revenue: db.revenue, orders: db.orders.size, events: db.events.size,
    }
  })
  const bars = Object.entries(byBar).filter(([b]) => b !== 'Walk-on' && b !== 'Unknown')
    .map(([bar, riders]) => ({ bar, riders })).sort((a, b) => b.riders - a.riders)
  const barTot = bars.reduce((s, b) => s + b.riders, 0)
  const nights = Object.entries(byNight).map(([d, r]) => ({ d, r })).sort((a, b) => b.r - a.r)
  const ridersAll = months.reduce((s, m) => s + m.riders, 0)
  const charterTot = months.reduce((s, m) => s + m.charter, 0)
  const revTot = months.reduce((s, m) => s + m.revenue, 0)
  const ordersTot = months.reduce((s, m) => s + m.orders, 0)
  const eventsTot = months.reduce((s, m) => s + m.events, 0)
  const cur = months.at(-1) || {}, prev = months.at(-2) || {}
  const mom = prev.riders ? Math.round((cur.riders / prev.riders - 1) * 100) : 0
  const bestNight = nights[0]

  const J = o => JSON.stringify(o)
  const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0a0a0b;--card:#141417;--gold:#d4a333;--gold2:#7a5d1b;--ink:#f4f0e6;--mut:#8a8578;--line:#26241e;--good:#5fae6b}
@page{size:letter;margin:0}*{box-sizing:border-box;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:var(--bg);color:var(--ink);font:11px/1.4 'Segoe UI',Roboto,sans-serif;padding:26px 30px}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid var(--gold);padding-bottom:9px;margin-bottom:14px}
.hd h1{font-size:20px;letter-spacing:.3px}.hd h1 b{color:var(--gold)}
.hd .r{color:var(--mut);font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:1.5px}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin-bottom:13px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:10px 11px}
.kpi .n{font-size:19px;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums;letter-spacing:-.5px}
.kpi .n.g{color:var(--good)}
.kpi .l{color:var(--mut);font-size:9px;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.grid{display:grid;grid-template-columns:1.5fr 1fr;gap:13px;margin-bottom:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:13px 15px}
.card h2{font-size:11px;color:var(--gold);letter-spacing:.06em;text-transform:uppercase;font-weight:600;margin-bottom:9px}
.chart{height:170px}.chart.sm{height:150px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{color:var(--gold);font-size:9px;letter-spacing:.04em;text-transform:uppercase;padding:4px 6px;border-bottom:1px solid var(--line);text-align:right}
th.l,td.l{text-align:left}td{padding:5px 6px;border-bottom:1px solid #1c1b16}td.v{font-weight:600}
.foot{color:var(--mut);font-size:9px;line-height:1.5;margin-top:11px;border-top:1px solid var(--line);padding-top:8px}
.foot b{color:var(--ink)}
</style></head><body>
<div class="hd"><h1><b>Jville Brew Loop</b> — Analytics Dashboard</h1>
<div class="r">Internal use only<br>Live from app DB · ${new Date().toISOString().slice(0, 10)}</div></div>

<div class="kpis">
 <div class="kpi"><div class="n">${ridersAll}</div><div class="l">Total riders (Mar→now)</div></div>
 <div class="kpi"><div class="n">${charterTot}</div><div class="l">Charter / party riders</div></div>
 <div class="kpi"><div class="n">${usd(revTot)}</div><div class="l">Native ticket rev (Stripe)</div></div>
 <div class="kpi"><div class="n">${eventsTot}</div><div class="l">Loop nights (DB)</div></div>
 <div class="kpi"><div class="n">${cur.riders || 0}</div><div class="l">${cur.label || '—'} riders</div></div>
 <div class="kpi"><div class="n ${mom >= 0 ? 'g' : ''}">${mom >= 0 ? '+' : ''}${mom}%</div><div class="l">MoM riders</div></div>
</div>

<div class="grid">
 <div class="card"><h2>Riders per month — individual vs charter</h2><div class="chart"><canvas id="c1"></canvas></div></div>
 <div class="card"><h2>Native ticket revenue / month (Stripe)</h2><div class="chart sm"><canvas id="c2"></canvas></div></div>
</div>

<div class="grid" style="grid-template-columns:1fr 1fr">
 <div class="card"><h2>Riders by bar — DB, May onward</h2>
  <table><thead><tr><th class="l">Bar</th><th>Riders</th><th>Share</th></tr></thead><tbody>
  ${bars.slice(0, 9).map(b => `<tr><td class="l v">${b.bar}</td><td class="v">${b.riders}</td><td style="color:var(--mut)">${Math.round(b.riders / barTot * 100)}%</td></tr>`).join('')}
  </tbody></table></div>
 <div class="card"><h2>Monthly detail</h2>
  <table><thead><tr><th class="l">Month</th><th>Riders</th><th>Indiv</th><th>Charter</th><th>Native rev</th></tr></thead><tbody>
  ${months.map(m => `<tr><td class="l v">${m.label}</td><td class="v">${m.riders}</td><td style="color:var(--mut)">${m.individual}</td><td style="color:var(--mut)">${m.charter}</td><td style="color:var(--gold)">${usd(m.revenue)}</td></tr>`).join('')}
  </tbody></table>
  <div style="margin-top:8px;color:var(--mut);font-size:9.5px">DB channel (May+) — Native <b style="color:var(--ink)">${nativeTot}</b> · Ticket Tailor <b style="color:var(--ink)">${ttTot}</b>${bestNight ? ` · Best night <b style="color:var(--ink)">${bestNight.d} (${bestNight.r})</b>` : ''}</div>
 </div>
</div>

<div class="foot"><b>How this is counted.</b> Monthly rider totals use the team's reconciled figures (Mar–May), then live DB from June on; pre-May Ticket Tailor imports are incomplete so the DB alone undercounts them. Per-bar and channel splits are live DB (May onward, where rider identities exist); ${founderTot} founder $0 tests excluded. <b>Native ticket revenue</b> = paid native /book (Stripe) orders only — it does NOT include Ticket Tailor sales or charter invoices, which bill on separate channels. For internal planning; confirm against the team tally before sharing externally.</div>

<script>
const C={gold:'#d4a333',gold2:'#7a5d1b',mut:'#8a8578',grid:'#26241e',ink:'#f4f0e6',good:'#5fae6b'};
Chart.defaults.color=C.mut;Chart.defaults.font.family='Segoe UI,sans-serif';Chart.defaults.animation=false;
const gx={grid:{color:C.grid},ticks:{color:C.mut}};
const L=${J(months.map(m => m.label))};
new Chart(c1,{type:'bar',data:{labels:L,datasets:[
 {label:'Individual',data:${J(months.map(m => m.individual))},backgroundColor:C.gold,stack:'s'},
 {label:'Charter / party',data:${J(months.map(m => m.charter))},backgroundColor:C.gold2,stack:'s'}]},
 options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:C.ink,boxWidth:11,font:{size:10}}}},scales:{x:{...gx,stacked:true},y:{...gx,stacked:true,beginAtZero:true}}}});
new Chart(c2,{type:'line',data:{labels:L,datasets:[
 {label:'Revenue',data:${J(months.map(m => Math.round(m.revenue / 100)))},borderColor:C.gold,backgroundColor:'rgba(212,163,51,.15)',fill:true,tension:.3,pointBackgroundColor:C.gold}]},
 options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:gx,y:{...gx,beginAtZero:true,ticks:{color:C.mut,callback:v=>'$'+v}}}}});
</script></body></html>`

  const tmp = path.join(DESKTOP, '_bl-dash-tmp'); if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
  const htmlPath = path.join(tmp, 'dash.html')
  const pdfPath = path.join(DESKTOP, 'JVille-Brew-Loop-Analytics-Dashboard.pdf')
  fs.writeFileSync(htmlPath, html, 'utf8')
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=20000', `--print-to-pdf=${pdfPath}`, `file:///${htmlPath.replace(/\\/g, '/')}`], { stdio: 'pipe' })
  try { fs.unlinkSync(htmlPath); fs.rmdirSync(tmp) } catch (e) {}
  console.log('Wrote PDF -> ' + pdfPath)
  console.log(`Riders(recon) ${ridersAll} | charter ${charterTot} | NativeRev ${usd(revTot)} | DB native ${nativeTot}/TT ${ttTot} | founder tests ${founderTot}`)
  console.log('Months:', months.map(m => `${m.label} ${m.riders}r (ind ${m.individual}/ch ${m.charter}) ${usd(m.revenue)}`).join(' · '))
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
