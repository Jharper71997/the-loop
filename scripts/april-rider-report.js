// One-shot: parse the Ticket Tailor MCP orders dump, filter to April 2026
// events, and write a per-bar JSON + markdown report to OneDrive Desktop.
//
// Per-bar attribution comes from each issued_ticket.description, which TT
// stores as "{Bar Name} - Pickup time {time}" or "Walk on rider". Order.total
// and ticket.listed_price are already in cents (currency.base_multiplier=100).

const fs = require('fs')
const path = require('path')

const DUMP = 'C:/Users/jacob/.claude/projects/C--Users-jacob/210d63cd-156a-4777-a9f8-d22f0d59a9cd/tool-results/mcp-claude_ai_Ticket_Tailor-orders_get-1777943653713.txt'

const APRIL_START = '2026-04-01'
const APRIL_END = '2026-04-30'

function parseBarFromDescription(desc) {
  if (!desc) return { bar: 'Unknown', kind: 'unknown' }
  let s = String(desc)

  // Strip "(inc. ...)" notes.
  s = s.replace(/\s*\(inc\.[^)]*\)\s*/gi, '').trim()

  if (/^walk[\s-]?on/i.test(s)) return { bar: 'Walk-on', kind: 'walk_on' }

  // "Hideaway Lounge - Pickup time 8:00 p.m."  → "Hideaway Lounge"
  // "Angry Ginger Pick Up - Day Drinking Brewery Tour" → "Angry Ginger Pick Up" → strip trailing "Pick Up"
  let head = s.split(/\s*[-–—]\s*/)[0].trim()
  head = head.replace(/\s+pick\s*up\s*$/i, '').trim()
  if (!head) return { bar: 'Unknown', kind: 'unknown' }

  // Normalize a couple known spellings.
  const normalized = head
    .replace(/^HideAway/i, 'Hideaway')
    .replace(/^The Velvet$/i, 'The Velvet')
  return { bar: normalized, kind: 'pickup' }
}

function dayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
}
function weekendKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function loadOrders() {
  const wrapper = JSON.parse(fs.readFileSync(DUMP, 'utf8'))
  const inner = JSON.parse(wrapper[0].text)
  return inner.data || []
}

function main() {
  const all = loadOrders()
  console.log(`Loaded ${all.length} orders from TT dump (since 2026-03-01)`)

  const orders = all.filter(o => {
    const d = o?.event_summary?.start_date?.date
    if (!d) return false
    if (d < APRIL_START || d > APRIL_END) return false
    if (o.status && o.status !== 'completed') return false
    return true
  })
  console.log(`April 2026 completed orders: ${orders.length}`)

  const byBar = new Map()
  const byWeekend = new Map()
  const byEvent = new Map()
  const byDay = new Map()
  let totalRiders = 0
  let totalRevenueCents = 0
  let voided = 0
  let walkOns = 0
  let vipComps = 0

  for (const o of orders) {
    const date = o.event_summary.start_date.date
    const eventId = o.event_summary.event_id
    const eventName = o.event_summary.name
    const wk = weekendKey(date)
    const dow = dayOfWeek(date)

    if (!byEvent.has(eventId)) {
      byEvent.set(eventId, {
        event_id: eventId, date, dow, name: eventName,
        riders: 0, revenue_cents: 0, orders: 0, bars: {},
      })
    }
    if (!byWeekend.has(wk)) byWeekend.set(wk, { weekend_of: wk, riders: 0, revenue_cents: 0, orders: 0, bars: {} })
    if (!byDay.has(date)) byDay.set(date, { date, dow, riders: 0, revenue_cents: 0, orders: 0, bars: {} })

    const evtRow = byEvent.get(eventId)
    const wkRow = byWeekend.get(wk)
    const dayRow = byDay.get(date)

    const tickets = (o.issued_tickets || []).filter(t => !t.status || t.status === 'valid')
    voided += (o.issued_tickets || []).length - tickets.length
    const orderCents = Math.round(Number(o.total || 0))
    totalRevenueCents += orderCents

    evtRow.orders += 1
    evtRow.revenue_cents += orderCents
    wkRow.orders += 1
    wkRow.revenue_cents += orderCents
    dayRow.orders += 1
    dayRow.revenue_cents += orderCents

    for (const t of tickets) {
      const desc = t.description || ''
      const { bar, kind } = parseBarFromDescription(desc)
      const isComp = /vip\s*comp/i.test(desc) || (t.listed_price === 0)
      const cents = Math.round(Number(t.listed_price || 0))

      if (!byBar.has(bar)) {
        byBar.set(bar, {
          bar_name: bar,
          riders: 0, revenue_cents: 0, orders: new Set(),
          events: new Set(), weekends: new Set(),
          comp_riders: 0, paid_riders: 0,
        })
      }
      const b = byBar.get(bar)
      b.riders += 1
      b.revenue_cents += cents
      b.orders.add(o.id)
      b.events.add(eventId)
      b.weekends.add(wk)
      if (isComp) b.comp_riders += 1
      else b.paid_riders += 1

      evtRow.riders += 1
      evtRow.bars[bar] = (evtRow.bars[bar] || 0) + 1
      wkRow.riders += 1
      wkRow.bars[bar] = (wkRow.bars[bar] || 0) + 1
      dayRow.riders += 1
      dayRow.bars[bar] = (dayRow.bars[bar] || 0) + 1

      totalRiders += 1
      if (kind === 'walk_on') walkOns += 1
      if (isComp) vipComps += 1
    }
  }

  const barRows = [...byBar.values()]
    .map(b => ({
      bar_name: b.bar_name,
      riders: b.riders,
      paid_riders: b.paid_riders,
      comp_riders: b.comp_riders,
      revenue_dollars: +(b.revenue_cents / 100).toFixed(2),
      orders: b.orders.size,
      events_pickedup: b.events.size,
      weekends_active: b.weekends.size,
      avg_riders_per_event: +(b.riders / Math.max(b.events.size, 1)).toFixed(1),
    }))
    .sort((a, b) => b.riders - a.riders)

  const weekendRows = [...byWeekend.values()].sort((a, b) => a.weekend_of.localeCompare(b.weekend_of))
  const eventRows = [...byEvent.values()].sort((a, b) => (a.date + a.name).localeCompare(b.date + b.name))
  const dayRows = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))

  const dowSplit = { Fri: { riders: 0, revenue_cents: 0, events: 0 }, Sat: { riders: 0, revenue_cents: 0, events: 0 } }
  for (const e of eventRows) {
    if (!dowSplit[e.dow]) dowSplit[e.dow] = { riders: 0, revenue_cents: 0, events: 0 }
    dowSplit[e.dow].riders += e.riders
    dowSplit[e.dow].revenue_cents += e.revenue_cents
    dowSplit[e.dow].events += 1
  }

  const report = {
    generated_at: new Date().toISOString(),
    source: 'ticket_tailor (via MCP)',
    period: { start: APRIL_START, end: APRIL_END },
    totals: {
      riders: totalRiders,
      revenue_dollars: +(totalRevenueCents / 100).toFixed(2),
      orders: orders.length,
      events_run: eventRows.length,
      weekends: weekendRows.length,
      avg_riders_per_event: eventRows.length ? +(totalRiders / eventRows.length).toFixed(1) : 0,
      avg_party_size: orders.length ? +(totalRiders / orders.length).toFixed(2) : 0,
      walk_on_riders: walkOns,
      vip_comp_riders: vipComps,
      voided_tickets_excluded: voided,
    },
    by_bar: barRows,
    by_weekend: weekendRows.map(w => ({
      weekend_of: w.weekend_of,
      riders: w.riders,
      revenue_dollars: +(w.revenue_cents / 100).toFixed(2),
      orders: w.orders,
      bars: w.bars,
    })),
    by_day: dayRows.map(d => ({
      date: d.date, dow: d.dow,
      riders: d.riders,
      revenue_dollars: +(d.revenue_cents / 100).toFixed(2),
      orders: d.orders,
      bars: d.bars,
    })),
    by_event: eventRows.map(e => ({
      date: e.date, dow: e.dow,
      name: e.name,
      riders: e.riders,
      revenue_dollars: +(e.revenue_cents / 100).toFixed(2),
      orders: e.orders,
      bars: e.bars,
    })),
    day_of_week_split: Object.fromEntries(Object.entries(dowSplit).map(([d, v]) => [d, {
      events: v.events,
      riders: v.riders,
      revenue_dollars: +(v.revenue_cents / 100).toFixed(2),
    }])),
  }

  const outDir = 'C:/Users/jacob/OneDrive/Desktop'
  fs.writeFileSync(path.join(outDir, 'brew-loop-april-2026-report.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(outDir, 'brew-loop-april-2026-report.md'), renderMarkdown(report))
  console.log(`\nWrote brew-loop-april-2026-report.{json,md} to ${outDir}\n`)
  console.log(renderMarkdown(report))
}

function renderMarkdown(r) {
  const L = []
  L.push(`# Jville Brew Loop — April 2026 Rider Report`)
  L.push('')
  L.push(`_Generated ${r.generated_at} from Ticket Tailor_`)
  L.push('')
  L.push(`**Window:** ${r.period.start} → ${r.period.end}`)
  L.push('')
  L.push(`## Totals`)
  L.push('')
  L.push(`| Metric | Value |`)
  L.push(`|---|---:|`)
  L.push(`| Riders | **${r.totals.riders}** |`)
  L.push(`| Revenue | **$${r.totals.revenue_dollars.toLocaleString()}** |`)
  L.push(`| Orders | ${r.totals.orders} |`)
  L.push(`| Events run | ${r.totals.events_run} |`)
  L.push(`| Weekends with rides | ${r.totals.weekends} |`)
  L.push(`| Avg riders / event | ${r.totals.avg_riders_per_event} |`)
  L.push(`| Avg party size | ${r.totals.avg_party_size} |`)
  L.push(`| Walk-on riders | ${r.totals.walk_on_riders} |`)
  L.push(`| VIP / comp riders | ${r.totals.vip_comp_riders} |`)
  if (r.totals.voided_tickets_excluded) L.push(`| Voided tickets (excluded) | ${r.totals.voided_tickets_excluded} |`)
  L.push('')
  L.push(`## Riders per bar (pickup bar)`)
  L.push('')
  L.push(`Each ticket's pickup bar is parsed from its description (e.g. "Hideaway Lounge - Pickup time 8:00 p.m."). "Walk-on" tickets aren't tied to a single pickup bar.`)
  L.push('')
  L.push(`| Bar | Riders | Paid | Comp | Revenue | Orders | Events | Wknds | Avg/event |`)
  L.push(`|---|---:|---:|---:|---:|---:|---:|---:|---:|`)
  for (const b of r.by_bar) {
    L.push(`| ${b.bar_name} | **${b.riders}** | ${b.paid_riders} | ${b.comp_riders} | $${b.revenue_dollars.toLocaleString()} | ${b.orders} | ${b.events_pickedup} | ${b.weekends_active} | ${b.avg_riders_per_event} |`)
  }
  L.push('')
  L.push(`## Weekends`)
  L.push('')
  L.push(`| Weekend of (Fri) | Riders | Revenue | Orders |`)
  L.push(`|---|---:|---:|---:|`)
  for (const w of r.by_weekend) {
    L.push(`| ${w.weekend_of} | ${w.riders} | $${w.revenue_dollars.toLocaleString()} | ${w.orders} |`)
  }
  L.push('')
  L.push(`### Per-bar by weekend`)
  L.push('')
  for (const w of r.by_weekend) {
    const bars = Object.entries(w.bars).sort((a, b) => b[1] - a[1])
    L.push(`- **${w.weekend_of}** (${w.riders} riders): ${bars.map(([n, c]) => `${n} ${c}`).join(', ') || '—'}`)
  }
  L.push('')
  L.push(`### Day-of-week split`)
  L.push('')
  L.push(`| Day | Events | Riders | Revenue |`)
  L.push(`|---|---:|---:|---:|`)
  for (const [d, v] of Object.entries(r.day_of_week_split)) {
    L.push(`| ${d} | ${v.events} | ${v.riders} | $${v.revenue_dollars.toLocaleString()} |`)
  }
  L.push('')
  L.push(`## Per-day detail`)
  L.push('')
  L.push(`| Date | DoW | Riders | Revenue | Orders | Bars (rider counts) |`)
  L.push(`|---|---|---:|---:|---:|---|`)
  for (const d of r.by_day) {
    const bars = Object.entries(d.bars).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', ')
    L.push(`| ${d.date} | ${d.dow} | ${d.riders} | $${d.revenue_dollars.toLocaleString()} | ${d.orders} | ${bars} |`)
  }
  L.push('')
  L.push(`## Per-event detail`)
  L.push('')
  L.push(`| Date | DoW | Event | Riders | Revenue | Orders | Bars |`)
  L.push(`|---|---|---|---:|---:|---:|---|`)
  for (const e of r.by_event) {
    const bars = Object.entries(e.bars).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', ')
    L.push(`| ${e.date} | ${e.dow} | ${e.name} | ${e.riders} | $${e.revenue_dollars.toLocaleString()} | ${e.orders} | ${bars} |`)
  }
  L.push('')
  return L.join('\n')
}

main()
