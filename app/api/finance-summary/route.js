import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TT_BASE = 'https://api.tickettailor.com/v1'

export async function GET() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return Response.json({ error: 'TICKET_TAILOR_API_KEY not set' }, { status: 500 })

  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
  const stripeData = stripe ? await fetchStripeData(stripe).catch(err => ({ error: err.message })) : null

  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')

  const now = Math.floor(Date.now() / 1000)
  const ninetyDaysAgo = now - 90 * 86400
  const orders = []
  let cursor = null
  for (let i = 0; i < 5; i++) {
    const url = new URL(`${TT_BASE}/orders`)
    url.searchParams.set('limit', '100')
    url.searchParams.set('created_at_gte', String(ninetyDaysAgo))
    if (cursor) url.searchParams.set('starting_after', cursor)
    const res = await fetch(url.toString(), { headers: { Authorization: auth, Accept: 'application/json' } })
    if (!res.ok) break
    const json = await res.json()
    const batch = json.data || []
    orders.push(...batch)
    if (!batch.length || !json.links?.next) break
    cursor = batch[batch.length - 1].id
  }

  const today = new Date().toISOString().slice(0, 10)
  const byMonth = {}
  const byNight = {}
  let upcomingRevenue = 0
  let upcomingTickets = 0
  let pastRevenue = 0
  let pastTickets = 0
  let refunded = 0

  for (const o of orders) {
    if (o.status !== 'completed') continue
    const totalCents = Number(o.total || 0)
    const refundCents = Number(o.refund_amount || 0)
    const netCents = totalCents - refundCents
    refunded += refundCents

    const date = o.event_summary?.start_date?.date
    if (!date) continue

    const month = date.slice(0, 7)
    byMonth[month] = (byMonth[month] || 0) + netCents

    const tickets = (o.issued_tickets || []).filter(t => t.status === 'valid').length

    if (!byNight[date]) byNight[date] = { revenue: 0, tickets: 0 }
    byNight[date].revenue += netCents
    byNight[date].tickets += tickets

    if (date >= today) {
      upcomingRevenue += netCents
      upcomingTickets += tickets
    } else {
      pastRevenue += netCents
      pastTickets += tickets
    }
  }

  const months = Object.entries(byMonth).sort().map(([month, cents]) => ({ month, revenue: cents / 100 }))
  const nights = Object.entries(byNight).sort().map(([date, v]) => ({
    date,
    revenue: v.revenue / 100,
    tickets: v.tickets,
    upcoming: date >= today,
  }))

  const last4Past = nights.filter(n => !n.upcoming).slice(-4)
  const avgPast4Revenue = last4Past.length ? last4Past.reduce((s, n) => s + n.revenue, 0) / last4Past.length : 0
  const avgPast4Riders = last4Past.length ? last4Past.reduce((s, n) => s + n.tickets, 0) / last4Past.length : 0

  return Response.json({
    ok: true,
    pastRevenue: pastRevenue / 100,
    pastTickets,
    upcomingRevenue: upcomingRevenue / 100,
    upcomingTickets,
    refunded: refunded / 100,
    months,
    nights,
    avgPast4Revenue,
    avgPast4Riders,
    stripe: stripeData,
  })
}

async function fetchStripeData(stripe) {
  const ninetyDaysAgoSec = Math.floor(Date.now() / 1000) - 90 * 86400

  const balance = await stripe.balance.retrieve()
  const available = (balance.available || []).reduce((s, b) => s + (b.amount || 0), 0) / 100
  const pending = (balance.pending || []).reduce((s, b) => s + (b.amount || 0), 0) / 100

  const payouts = []
  for await (const p of stripe.payouts.list({ limit: 100, created: { gte: ninetyDaysAgoSec } })) {
    payouts.push({
      id: p.id,
      amount: p.amount / 100,
      arrival_date: p.arrival_date,
      status: p.status,
    })
    if (payouts.length >= 50) break
  }
  const paidOut = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  let grossLast90 = 0
  let netLast90 = 0
  let feesLast90 = 0
  let chargeCount = 0
  let refundedLast90 = 0
  let txnCount = 0
  for await (const bt of stripe.balanceTransactions.list({ limit: 100, created: { gte: ninetyDaysAgoSec } })) {
    if (bt.type === 'charge') {
      grossLast90 += (bt.amount || 0) / 100
      netLast90 += (bt.net || 0) / 100
      feesLast90 += (bt.fee || 0) / 100
      chargeCount++
    } else if (bt.type === 'refund') {
      refundedLast90 += Math.abs(bt.amount || 0) / 100
    }
    txnCount++
    if (txnCount >= 500) break
  }

  return {
    balanceAvailable: available,
    balancePending: pending,
    paidOutLast90: paidOut,
    grossLast90,
    netLast90,
    feesLast90,
    refundedLast90,
    chargeCount,
    payouts: payouts.slice(0, 10),
  }
}
