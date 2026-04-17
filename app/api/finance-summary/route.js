export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TT_BASE = 'https://api.tickettailor.com/v1'

export async function GET() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return Response.json({ error: 'TICKET_TAILOR_API_KEY not set' }, { status: 500 })

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
  })
}
