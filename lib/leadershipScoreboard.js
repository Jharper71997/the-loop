import { supabaseAdmin } from './supabaseAdmin'

// Server-side aggregator for /leadership scoreboard. Returns all 12 metrics
// in a single pass with Promise.all so the page renders in one round-trip.
// Missing data returns 0 / null with a `note` field explaining what's
// blocking the metric so the UI can show a graceful empty state.

const WEEKLY_REVENUE_TARGET = 225000           // $2,250 in cents per Q2 plan
const BANK_BALANCE_FLOOR = 200000              // $2,000 cents (AFCO threshold)
const NET_PROFIT_MTD_TARGET = 26300            // $263 cents
const RUNWAY_TARGET_DAYS = 30
const PRESALES_TARGET = 15
const SPONSOR_PIPELINE_TARGET = 150000         // $1,500 cents
const BAR_PIPELINE_TARGET = 3
const CONVERSION_TARGET = 0.03                 // 3%
const ACTIVE_SPONSORS_TARGET = 15
const ACTIVE_BARS_TARGET = 8
const MRR_TARGET = 550000           // $5,500/mo cents — path to $66k annual
const MOM_GROWTH_TARGET = 0.10      // +10% month-over-month

function status(actual, target, opts = {}) {
  if (actual == null || target == null) return 'unknown'
  const ratio = actual / target
  const greenAt = opts.greenAt ?? 1
  const yellowAt = opts.yellowAt ?? 0.7
  if (ratio >= greenAt) return 'green'
  if (ratio >= yellowAt) return 'yellow'
  return 'red'
}

function startOfWeek(d = new Date()) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfWeek(d = new Date()) {
  const start = startOfWeek(d)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return end
}

function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  return x
}

function pastWeekendRange(d = new Date()) {
  const x = new Date(d)
  const day = x.getDay()
  let daysBackToFri
  if (day >= 5) daysBackToFri = day === 5 ? 0 : day - 5  // Fri or Sat: this Fri
  else daysBackToFri = day + 2  // Sun-Thu: last Fri
  const fri = new Date(x)
  fri.setDate(fri.getDate() - daysBackToFri)
  fri.setHours(0, 0, 0, 0)
  const sun = new Date(fri)
  sun.setDate(sun.getDate() + 3)
  return { start: fri, end: sun }
}

function nextSevenDays(d = new Date()) {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

export async function getScoreboard() {
  const supabase = supabaseAdmin()
  const now = new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)
  const monthStart = startOfMonth(now)
  const weekend = pastWeekendRange(now)
  const next7 = nextSevenDays(now)

  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = monthStart  // exclusive

  // Parallel data fetch.
  const [
    weekOrders,
    weekSponsorPay,
    weekBarPay,
    bankBalanceRow,
    monthOrders,
    monthSponsorPay,
    monthBarPay,
    monthExpenses,
    presoldOrders,
    activeSponsors,
    activeBars,
    sponsorRoster,
    barRoster,
    monthSponsorPayDetail,
    monthBarPayDetail,
    lastMonthOrders,
    lastMonthSponsorPay,
    lastMonthBarPay,
  ] = await Promise.all([
    supabase.from('orders')
      .select('total_cents')
      .eq('status', 'paid')
      .is('refunded_at', null)
      .gte('paid_at', weekStart.toISOString())
      .lt('paid_at', weekEnd.toISOString()),
    supabase.from('sponsor_payments')
      .select('amount_cents')
      .gte('paid_at', weekStart.toISOString())
      .lt('paid_at', weekEnd.toISOString()),
    supabase.from('bar_payments')
      .select('amount_cents')
      .gte('paid_at', weekStart.toISOString())
      .lt('paid_at', weekEnd.toISOString()),
    supabase.from('bank_balances')
      .select('balance_cents, as_of, account_name')
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('orders')
      .select('total_cents')
      .eq('status', 'paid')
      .is('refunded_at', null)
      .gte('paid_at', monthStart.toISOString()),
    supabase.from('sponsor_payments')
      .select('amount_cents')
      .gte('paid_at', monthStart.toISOString()),
    supabase.from('bar_payments')
      .select('amount_cents')
      .gte('paid_at', monthStart.toISOString()),
    supabase.from('expenses')
      .select('amount_cents')
      .gte('expense_date', monthStart.toISOString().slice(0, 10)),
    supabase.from('orders')
      .select('id, event_id, events(event_date)')
      .eq('status', 'paid')
      .is('refunded_at', null)
      .gte('events.event_date', next7.start.toISOString().slice(0, 10))
      .lt('events.event_date', next7.end.toISOString().slice(0, 10)),
    supabase.from('sponsors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid'),
    supabase.from('bars')
      .select('slug', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('sponsors')
      .select('id, amount_committed, status')
      .in('status', ['committed', 'paid']),
    supabase.from('bars')
      .select('slug, monthly_fee_cents, status')
      .in('status', ['active', 'prospect']),
    supabase.from('sponsor_payments')
      .select('sponsor_id, paid_at, paid_for_period, amount_cents')
      .or(`paid_for_period.like.${monthStr}%,paid_at.gte.${monthStart.toISOString()}`),
    supabase.from('bar_payments')
      .select('bar_slug, paid_at, paid_for_period, amount_cents')
      .or(`paid_for_period.like.${monthStr}%,paid_at.gte.${monthStart.toISOString()}`),
    supabase.from('orders')
      .select('total_cents')
      .eq('status', 'paid')
      .is('refunded_at', null)
      .gte('paid_at', lastMonthStart.toISOString())
      .lt('paid_at', lastMonthEnd.toISOString()),
    supabase.from('sponsor_payments')
      .select('amount_cents')
      .gte('paid_at', lastMonthStart.toISOString())
      .lt('paid_at', lastMonthEnd.toISOString()),
    supabase.from('bar_payments')
      .select('amount_cents')
      .gte('paid_at', lastMonthStart.toISOString())
      .lt('paid_at', lastMonthEnd.toISOString()),
  ])

  const sumCents = (rows) =>
    (rows?.data || []).reduce((s, r) => s + (r.amount_cents ?? r.total_cents ?? 0), 0)

  const weekRevenue = sumCents(weekOrders) + sumCents(weekSponsorPay) + sumCents(weekBarPay)
  const monthRevenue = sumCents(monthOrders) + sumCents(monthSponsorPay) + sumCents(monthBarPay)
  const monthExpensesCents = sumCents(monthExpenses)
  const netProfitMTD = monthRevenue - monthExpensesCents

  const bankBalance = bankBalanceRow?.data?.balance_cents ?? null
  const bankAsOf = bankBalanceRow?.data?.as_of ?? null

  // Outstanding this month — bars + sponsors who haven't paid their monthly fee yet.
  // For sponsors: amount_committed treated as monthly fee per Asana convention.
  // For bars: monthly_fee_cents directly.
  function paidThisMonthMap(rows, idField) {
    const m = new Map()
    for (const r of (rows?.data || [])) {
      const inMonth = r.paid_for_period
        ? r.paid_for_period.startsWith(monthStr)
        : (r.paid_at >= monthStart.toISOString())
      if (!inMonth) continue
      m.set(r[idField], (m.get(r[idField]) || 0) + (r.amount_cents || 0))
    }
    return m
  }
  const sponsorPaidMap = paidThisMonthMap(monthSponsorPayDetail, 'sponsor_id')
  const barPaidMap = paidThisMonthMap(monthBarPayDetail, 'bar_slug')

  let sponsorOwedCents = 0
  let sponsorBehindCount = 0
  for (const s of (sponsorRoster?.data || [])) {
    const monthlyCents = Math.round(Number(s.amount_committed || 0) * 100)
    if (!monthlyCents) continue
    const paid = sponsorPaidMap.get(s.id) || 0
    const owed = Math.max(0, monthlyCents - paid)
    if (owed > 0) {
      sponsorOwedCents += owed
      sponsorBehindCount += 1
    }
  }

  let barOwedCents = 0
  let barBehindCount = 0
  for (const b of (barRoster?.data || [])) {
    if (b.status !== 'active') continue
    if (!b.monthly_fee_cents) continue
    const paid = barPaidMap.get(b.slug) || 0
    const owed = Math.max(0, b.monthly_fee_cents - paid)
    if (owed > 0) {
      barOwedCents += owed
      barBehindCount += 1
    }
  }

  // MRR — sum of monthly recurring fees from active partners.
  // Sponsors: amount_committed × 100 for status='paid'; in-kind ($0) skipped.
  // Bars: monthly_fee_cents for status='active'; free-this-month bars at $0 skipped.
  let mrrCents = 0
  for (const s of (sponsorRoster?.data || [])) {
    if (s.status !== 'paid') continue
    mrrCents += Math.round(Number(s.amount_committed || 0) * 100)
  }
  for (const b of (barRoster?.data || [])) {
    if (b.status !== 'active') continue
    mrrCents += Math.max(0, b.monthly_fee_cents || 0)
  }

  // MoM income growth: this month's income vs last month's, % delta.
  const lastMonthRevenue =
    sumCents(lastMonthOrders) + sumCents(lastMonthSponsorPay) + sumCents(lastMonthBarPay)
  const momGrowth = lastMonthRevenue > 0
    ? (monthRevenue - lastMonthRevenue) / lastMonthRevenue
    : null

  // Days runway = bank balance / avg daily burn (last month expenses / 30).
  // If we don't have either, return null and let the card show a graceful state.
  const avgDailyBurnCents = monthExpensesCents > 0
    ? monthExpensesCents / Math.max(1, now.getDate())
    : null
  const daysRunway = (bankBalance != null && avgDailyBurnCents)
    ? Math.floor(bankBalance / avgDailyBurnCents)
    : null

  // Presold tickets: orders.events join may produce nulls if event is null,
  // so we filter client-side as a safety net.
  const presold = (presoldOrders?.data || []).filter(o => o.events).length

  return {
    weeklyRevenue: {
      label: 'Weekly Revenue',
      valueCents: weekRevenue,
      targetCents: WEEKLY_REVENUE_TARGET,
      status: status(weekRevenue, WEEKLY_REVENUE_TARGET),
      drillTo: '/leadership/income',
      note: weekRevenue === 0 ? 'No paid orders or payments this week' : null,
    },
    bankBalance: {
      label: 'Bank Balance',
      valueCents: bankBalance,
      targetCents: BANK_BALANCE_FLOOR,
      asOf: bankAsOf,
      status: bankBalance == null
        ? 'unknown'
        : (bankBalance >= BANK_BALANCE_FLOOR ? 'green' : 'red'),
      drillTo: '/leadership/cash',
      note: bankBalance == null ? 'Enter at /leadership/cash/new' : null,
    },
    netProfitMTD: {
      label: 'Net Profit MTD',
      valueCents: netProfitMTD,
      targetCents: NET_PROFIT_MTD_TARGET,
      status: status(netProfitMTD, NET_PROFIT_MTD_TARGET),
      drillTo: '/leadership/expenses',
      note: monthExpensesCents === 0 ? 'No expenses entered yet · /leadership/expenses/import' : null,
    },
    daysRunway: {
      label: 'Days Runway',
      value: daysRunway,
      target: RUNWAY_TARGET_DAYS,
      status: status(daysRunway, RUNWAY_TARGET_DAYS),
      drillTo: '/leadership/cash',
      note: daysRunway == null
        ? (bankBalance == null ? 'Need bank balance' : 'Need expenses · /leadership/expenses/import')
        : null,
    },
    presold: {
      label: 'Presold (Next 7d)',
      value: presold,
      target: PRESALES_TARGET,
      status: status(presold, PRESALES_TARGET),
      drillTo: '/leadership/income',
      note: presold === 0 ? 'No tickets sold for next-weekend events' : null,
    },
    sponsorPipeline: {
      label: 'Sponsor Pipeline ($)',
      valueCents: null,
      targetCents: SPONSOR_PIPELINE_TARGET,
      status: 'unknown',
      drillTo: '/leadership/sponsors',
      note: 'Asana wiring lands Evening 6',
    },
    barPipeline: {
      label: 'Bar Pipeline (#)',
      value: null,
      target: BAR_PIPELINE_TARGET,
      status: 'unknown',
      drillTo: '/leadership/bars',
      note: 'Asana wiring lands Evening 6',
    },
    conversion: {
      label: 'Visit → Ticket %',
      value: null,
      target: CONVERSION_TARGET,
      isPercent: true,
      status: 'unknown',
      drillTo: '/leadership/income',
      note: 'Vercel Analytics wiring lands Evening 6',
    },
    activeSponsors: {
      label: 'Active Sponsors',
      value: activeSponsors?.count ?? 0,
      target: ACTIVE_SPONSORS_TARGET,
      status: status(activeSponsors?.count ?? 0, ACTIVE_SPONSORS_TARGET),
      drillTo: '/leadership/sponsors',
      note: (activeSponsors?.count ?? 0) === 0
        ? 'No sponsors with status committed/paid yet'
        : (sponsorOwedCents > 0
            ? `${formatCents(sponsorOwedCents)} owed this month · ${sponsorBehindCount} behind`
            : 'All paid this month'),
    },
    activeBars: {
      label: 'Active Bars',
      value: activeBars?.count ?? 0,
      target: ACTIVE_BARS_TARGET,
      status: status(activeBars?.count ?? 0, ACTIVE_BARS_TARGET),
      drillTo: '/leadership/bars',
      note: barOwedCents > 0
        ? `${formatCents(barOwedCents)} owed this month · ${barBehindCount} behind`
        : (activeBars?.count > 0 ? 'All paid this month' : null),
    },
    mrr: {
      label: 'MRR',
      valueCents: mrrCents,
      targetCents: MRR_TARGET,
      status: status(mrrCents, MRR_TARGET),
      drillTo: '/leadership/income',
      note: mrrCents === 0 ? 'No active partners with monthly fees yet' : null,
    },
    momGrowth: {
      label: 'MoM Income Growth',
      value: momGrowth,
      target: MOM_GROWTH_TARGET,
      isPercent: true,
      status: momGrowth == null
        ? 'unknown'
        : (momGrowth >= MOM_GROWTH_TARGET ? 'green'
            : momGrowth >= 0 ? 'yellow'
            : 'red'),
      drillTo: '/leadership/income',
      note: momGrowth == null ? 'No prior-month income to compare yet' : null,
    },
  }
}

export function formatCents(cents) {
  if (cents == null) return '—'
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1000) {
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(n) {
  if (n == null) return '—'
  return n.toLocaleString('en-US')
}

export function formatPercent(n) {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}
