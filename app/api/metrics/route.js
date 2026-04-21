import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/metrics
// Aggregates the three operator-cockpit KPI groups the user picked:
//   - Ridership trend + revenue (8-week rolling, WoW delta, next-week forecast)
//   - Conversion funnel (scan -> /book view -> checkout_started -> paid)
//   - Bar performance + waiver/check-in compliance
//
// Everything the /metrics page needs in one fetch, mirroring the finance-data
// endpoint's shape.
export async function GET() {
  const supabase = supabaseAdmin()
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const since8w = new Date(today.getTime() - 56 * 86400000).toISOString()
  const since30d = new Date(today.getTime() - 30 * 86400000).toISOString()

  const [ordersRes, expensesRes, membersRes, groupsRes, qrCodesRes, qrScansRes, orderItemsRes] = await Promise.all([
    supabase.from('orders')
      .select('id, total_cents, status, paid_at, party_size, contact_id, event_id, metadata, events(event_date, group_id)')
      .gte('paid_at', since8w)
      .eq('status', 'paid'),
    supabase.from('expenses')
      .select('amount_cents, expense_date, group_id')
      .gte('expense_date', since8w.slice(0, 10))
      .limit(500),
    supabase.from('group_members')
      .select('group_id, current_stop_index, contacts(id, has_signed_waiver)'),
    supabase.from('groups')
      .select('id, name, event_date, schedule')
      .gte('event_date', since8w.slice(0, 10))
      .order('event_date', { ascending: true }),
    supabase.from('qr_codes').select('id, kind, utm_source, label, code, created_at'),
    supabase.from('qr_scans').select('qr_id, scanned_at, resulting_order_id').gte('scanned_at', since30d),
    supabase.from('order_items')
      .select('id, order_id, checked_in_at, orders!inner(status, paid_at, event_id, events(group_id, event_date))')
      .gte('orders.paid_at', since8w),
  ])

  const orders = ordersRes.data || []
  const expenses = expensesRes.data || []
  const members = membersRes.data || []
  const groups = groupsRes.data || []
  const qrCodes = qrCodesRes.data || []
  const qrScans = qrScansRes.data || []
  const orderItems = orderItemsRes.data || []

  // ---------- Ridership + revenue weekly ----------
  const weeks = buildWeeklyBuckets(today)
  const weekIndex = new Map(weeks.map((w, i) => [w.key, i]))

  for (const o of orders) {
    const iso = o.events?.event_date || (o.paid_at ? o.paid_at.slice(0, 10) : null)
    const wkKey = isoWeekKey(iso)
    const idx = weekIndex.get(wkKey)
    if (idx == null) continue
    weeks[idx].riders += o.party_size || 0
    weeks[idx].revenue_cents += o.total_cents || 0
  }
  for (const e of expenses) {
    const wkKey = isoWeekKey(e.expense_date)
    const idx = weekIndex.get(wkKey)
    if (idx == null) continue
    weeks[idx].expenses_cents += e.amount_cents || 0
  }

  const thisWeek = weeks[weeks.length - 1]
  const lastWeek = weeks[weeks.length - 2] || { riders: 0, revenue_cents: 0 }
  const ridersWoW = lastWeek.riders ? Math.round(((thisWeek.riders - lastWeek.riders) / lastWeek.riders) * 100) : null
  const revenueWoW = lastWeek.revenue_cents ? Math.round(((thisWeek.revenue_cents - lastWeek.revenue_cents) / lastWeek.revenue_cents) * 100) : null

  // Next-week forecast: paid party_size for groups with event_date within next 7 days
  const forecastEnd = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const upcomingGroups = groups.filter(g => g.event_date >= todayIso && g.event_date <= forecastEnd)
  let forecastRiders = 0
  for (const o of orders) {
    const gid = o.events?.group_id
    if (!gid) continue
    if (upcomingGroups.some(g => g.id === gid)) forecastRiders += o.party_size || 0
  }

  // ---------- Funnel ----------
  // Scans -> paid conversions. Views/checkout-started aren't instrumented yet
  // (would need a beacon on /book). We surface scan + conversion today; view
  // and checkout_started placeholders return null so the UI can hide them
  // until wired.
  const funnelByKind = {}
  for (const qr of qrCodes) {
    funnelByKind[qr.kind] = funnelByKind[qr.kind] || { kind: qr.kind, scans: 0, conversions: 0 }
  }
  const scansByQr = new Map()
  const convByQr = new Map()
  for (const s of qrScans) {
    scansByQr.set(s.qr_id, (scansByQr.get(s.qr_id) || 0) + 1)
    if (s.resulting_order_id) convByQr.set(s.qr_id, (convByQr.get(s.qr_id) || 0) + 1)
  }
  for (const qr of qrCodes) {
    const f = funnelByKind[qr.kind]
    if (!f) continue
    f.scans += scansByQr.get(qr.id) || 0
    f.conversions += convByQr.get(qr.id) || 0
  }

  const funnelBySource = {}
  for (const qr of qrCodes) {
    const src = qr.utm_source || qr.label || `qr:${qr.code}`
    funnelBySource[src] = funnelBySource[src] || { source: src, scans: 0, conversions: 0 }
    funnelBySource[src].scans += scansByQr.get(qr.id) || 0
    funnelBySource[src].conversions += convByQr.get(qr.id) || 0
  }

  // ---------- Bar performance (last 4 weekends) ----------
  // Uses groups.schedule[i].name joined to group_members.current_stop_index
  // as a proxy for "riders picked up at this bar on this Loop".
  const barTotals = {}
  for (const g of groups) {
    const stops = Array.isArray(g.schedule) ? g.schedule : []
    const groupMembers = members.filter(m => m.group_id === g.id)
    for (const m of groupMembers) {
      const idx = m.current_stop_index
      if (idx == null || idx < 0 || idx >= stops.length) continue
      const name = stops[idx]?.name
      if (!name) continue
      barTotals[name] = barTotals[name] || { name, riders: 0, last_weekend_riders: 0 }
      barTotals[name].riders += 1
      if (g.event_date >= since8w.slice(0, 10)) {
        const wkOld = new Date(g.event_date) >= new Date(today.getTime() - 14 * 86400000)
        if (wkOld) barTotals[name].last_weekend_riders += 1
      }
    }
  }
  const barPerformance = Object.values(barTotals).sort((a, b) => b.riders - a.riders)

  // ---------- Compliance ----------
  const totalRiders = members.length
  const signedRiders = members.filter(m => m.contacts?.has_signed_waiver).length
  const waiverPct = totalRiders ? Math.round((signedRiders / totalRiders) * 100) : null

  const totalPaidTickets = orderItems.length
  const checkedInTickets = orderItems.filter(oi => oi.checked_in_at).length
  const checkinPct = totalPaidTickets ? Math.round((checkedInTickets / totalPaidTickets) * 100) : null

  const unsignedRiders = members
    .filter(m => m.contacts && !m.contacts.has_signed_waiver)
    .length

  return Response.json({
    summary: {
      riders_this_week: thisWeek.riders,
      riders_last_week: lastWeek.riders,
      riders_wow_pct: ridersWoW,
      revenue_this_week_cents: thisWeek.revenue_cents,
      revenue_last_week_cents: lastWeek.revenue_cents,
      revenue_wow_pct: revenueWoW,
      net_this_week_cents: thisWeek.revenue_cents - thisWeek.expenses_cents,
      forecast_riders_next_7d: forecastRiders,
      unsigned_riders: unsignedRiders,
    },
    weekly: weeks,
    funnel: {
      by_kind: Object.values(funnelByKind),
      by_source: Object.values(funnelBySource).sort((a, b) => b.scans - a.scans),
    },
    bars: barPerformance,
    compliance: {
      waiver_signed: signedRiders,
      waiver_total: totalRiders,
      waiver_pct: waiverPct,
      checkin_total: totalPaidTickets,
      checkin_done: checkedInTickets,
      checkin_pct: checkinPct,
    },
  })
}

function buildWeeklyBuckets(today) {
  // 8 buckets, oldest first. Each week is Mon 00:00 -> Sun 23:59 local.
  const weeks = []
  const cursor = new Date(today)
  // Normalize to Monday
  const day = cursor.getDay() // 0=Sun..6=Sat
  const daysFromMonday = (day + 6) % 7
  cursor.setDate(cursor.getDate() - daysFromMonday)
  cursor.setHours(0, 0, 0, 0)
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(cursor)
    weekStart.setDate(cursor.getDate() - i * 7)
    const key = isoWeekKey(weekStart.toISOString().slice(0, 10))
    weeks.push({
      key,
      start: weekStart.toISOString().slice(0, 10),
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      riders: 0,
      revenue_cents: 0,
      expenses_cents: 0,
    })
  }
  return weeks
}

function isoWeekKey(isoDate) {
  if (!isoDate) return null
  const d = new Date(`${isoDate}T12:00:00Z`)
  if (isNaN(d)) return null
  // YYYY-Www using Monday as week start
  const day = d.getUTCDay()
  const daysFromMonday = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysFromMonday)
  const yr = d.getUTCFullYear()
  const janFirst = new Date(Date.UTC(yr, 0, 1))
  const weekNum = Math.floor((d - janFirst) / (7 * 86400000)) + 1
  return `${yr}-W${String(weekNum).padStart(2, '0')}`
}
