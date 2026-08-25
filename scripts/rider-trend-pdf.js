// Builds a print-ready PDF of the Mar-May 2026 ridership trend and saves it to
// the Desktop, rendering via headless Edge (same path the partner-report PDFs use).
//
// Numbers are stated explicitly here so they're easy to correct:
//   Individual riders  = app orders table (TT-import + native), by paid date.
//   Charter / parties  = booked private groups (separate channel), incl. the
//                        17-person May party and the 14-person April Angry Ginger party.
// New-vs-recurring is intentionally NOT charted: pre-May Ticket Tailor records have
// rider identities redacted, so repeat riders can't be told apart before May.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DESKTOP = 'C:\\Users\\jacob\\OneDrive\\Desktop'
const TMP = path.join(DESKTOP, '_jville-reports-temp')

const DATA = [
  { label: 'March',    individual: 39, charter: 0,  note: '' },
  { label: 'April',    individual: 60, charter: 14, note: '14-person Angry Ginger party' },
  { label: 'May',      individual: 64, charter: 19, note: 'incl. 17-person booked party' },
].map(r => ({ ...r, total: r.individual + r.charter }))

const totals = DATA.map(r => r.total)
const J = o => JSON.stringify(o)
const grandTotal = totals.reduce((s, n) => s + n, 0)
const growth = Math.round((totals.at(-1) / totals[0] - 1) * 100)

const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0a0a0b;--card:#141417;--gold:#d4a333;--gold2:#8a6a1f;--ink:#f4f0e6;--mut:#8a8578;--line:#26241e}
@page{size:letter;margin:0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 'Segoe UI',Roboto,sans-serif;padding:40px 46px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:22px}
h1{font-size:23px;margin:0;letter-spacing:.01em}
.hd .r{color:var(--mut);font-size:12px;text-align:right}
.kpis{display:flex;gap:14px;margin-bottom:22px}
.kpi{flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.kpi .n{font-size:26px;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}
.kpi .l{color:var(--mut);font-size:11.5px;margin-top:2px}
.row{display:flex;gap:18px;align-items:flex-start}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:18px}
.card h2{font-size:13px;margin:0 0 12px;color:var(--gold);letter-spacing:.05em;text-transform:uppercase;font-weight:600}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{color:var(--gold);font-size:11px;letter-spacing:.04em;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line);text-align:right}
th.l,td.l{text-align:left}
td{padding:9px 8px;border-bottom:1px solid #1c1b16}
td.tot{color:var(--gold);font-weight:700;font-size:16px}
.note{color:var(--mut);font-size:11px;line-height:1.6;margin-top:4px}
.chart-wrap{height:230px}
code{color:var(--gold)}
</style></head><body>
<div class="hd"><h1>Jville Brew Loop &mdash; Ridership Trend</h1><div class="r">March &ndash; May 2026<br>Total riders, both booking channels</div></div>
<div class="kpis">
  <div class="kpi"><div class="n">${grandTotal}</div><div class="l">Total riders, Mar&ndash;May</div></div>
  <div class="kpi"><div class="n">${totals[0]} &rarr; ${totals.at(-1)}</div><div class="l">March to May (+${growth}%)</div></div>
  <div class="kpi"><div class="n">${DATA.at(-1).total}</div><div class="l">May riders</div></div>
  <div class="kpi"><div class="n">${DATA.at(-1).charter}</div><div class="l">May charter / party riders</div></div>
</div>
<div class="card"><h2>Total riders per month</h2><div class="chart-wrap"><canvas id="c1"></canvas></div></div>
<div class="row">
  <div class="card" style="flex:1.1"><h2>By the numbers</h2>
    <table><thead><tr><th class="l">Month</th><th>Individual</th><th>Charter / party</th><th>Total</th></tr></thead><tbody>
    ${DATA.map(r => `<tr><td class="l" style="color:var(--ink);font-weight:600">${r.label}</td><td style="color:var(--mut)">${r.individual}</td><td style="color:var(--mut)">${r.charter}${r.note ? ` <span style="font-size:10px">(${r.note})</span>` : ''}</td><td class="tot">${r.total}</td></tr>`).join('')}
    </tbody></table></div>
  <div class="card" style="flex:.9"><h2>New vs recurring</h2>
    <div class="note" style="font-size:11.5px">Not shown for this window: the Ticket Tailor records covering January&ndash;April have rider names and emails redacted (<code>"**** ****"</code>), so repeat riders can't be identified. Real rider identities begin in <b style="color:var(--ink)">May</b> with native /book, so new-vs-returning becomes trackable from this point forward.</div></div>
</div>
<p class="note"><b>How this is counted.</b> Individual riders come from the app orders table (Ticket Tailor + native /book bookings). Charter / party riders are booked privately by invoice (a separate channel) and added on top, including the 17-person booked party in May and the 14-person Angry Ginger party in April. Native /book went live in late April, which is why the channel mix shifts into May. Figures are best-available reconciliations; confirm against the team's manual tally before sharing externally.</p>
<script>
const L=${J(DATA.map(r => r.label))};
const C={gold:'#d4a333',gold2:'#8a6a1f',mut:'#8a8578',grid:'#26241e',ink:'#f4f0e6'};
Chart.defaults.color=C.mut;Chart.defaults.font.family='Segoe UI,sans-serif';Chart.defaults.animation=false;
const gx={grid:{color:C.grid},ticks:{color:C.mut}};
const totals=${J(totals)};
const bt={id:'bt',afterDatasetsDraw(ch){const x=ch.ctx;x.save();x.font='700 14px Segoe UI';x.fillStyle=C.ink;x.textAlign='center';x.textBaseline='bottom';const top=ch.getDatasetMeta(1);top.data.forEach((el,i)=>x.fillText(totals[i],el.x,el.y-6));x.font='600 12px Segoe UI';x.textBaseline='middle';ch.data.datasets.forEach((ds,di)=>{const m=ch.getDatasetMeta(di);m.data.forEach((el,i)=>{const v=ds.data[i];if(v>0){x.fillStyle=di===0?'#0a0a0b':'#0a0a0b';x.fillText(v,el.x,(el.y+el.base)/2)}})});x.restore()}};
new Chart(c1,{type:'bar',plugins:[bt],data:{labels:L,datasets:[
 {label:'Individual riders',data:${J(DATA.map(r => r.individual))},backgroundColor:C.gold,stack:'s'},
 {label:'Charter / party',data:${J(DATA.map(r => r.charter))},backgroundColor:C.gold2,stack:'s'}]},
 options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:20}},plugins:{legend:{labels:{color:C.ink}}},scales:{x:{...gx,stacked:true},y:{...gx,stacked:true,beginAtZero:true}}}});
</script></body></html>`

if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })
const htmlPath = path.join(TMP, 'ridership.html')
const pdfPath = path.join(DESKTOP, 'JVille-Brew-Loop-Ridership-Mar-May-2026.pdf')
fs.writeFileSync(htmlPath, html, 'utf8')
execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=20000', `--print-to-pdf=${pdfPath}`, `file:///${htmlPath.replace(/\\/g, '/')}`], { stdio: 'pipe' })
try { fs.unlinkSync(htmlPath); fs.rmdirSync(TMP) } catch (e) {}
console.log('Wrote PDF -> ' + pdfPath)
console.log('Totals:', DATA.map(r => `${r.label} ${r.total}`).join(' / '), '| grand', grandTotal)
