import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { handleOrder } from '@/lib/ticketTailor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TT_BASE = 'https://api.tickettailor.com/v1'

export async function POST() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'TICKET_TAILOR_API_KEY not set' }, { status: 500 })
  }

  const supabase = supabaseAdmin()
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')

  let cursor = null
  let pages = 0
  let ordersSeen = 0
  let ordersProcessed = 0
  let ridersUpserted = 0
  let membershipsUpserted = 0
  let ticketsSkipped = 0
  const errors = []

  while (true) {
    const url = new URL(`${TT_BASE}/orders`)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('starting_after', cursor)

    const res = await fetch(url.toString(), {
      headers: { Authorization: auth, Accept: 'application/json' },
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `TT API error ${res.status}`, detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    const json = await res.json()
    const orders = Array.isArray(json.data) ? json.data : []
    if (!orders.length) break

    pages++
    ordersSeen += orders.length

    for (const order of orders) {
      try {
        const result = await handleOrder(supabase, order)
        if (result?.upserts) {
          ordersProcessed++
          ridersUpserted += result.upserts
          membershipsUpserted += result.memberships || 0
          ticketsSkipped += result.skippedVoid || 0
        }
      } catch (err) {
        errors.push({ order_id: order.id, error: err?.message || String(err) })
      }
    }

    cursor = orders[orders.length - 1].id
    if (!json.links?.next) break
    if (pages >= 50) break
  }

  return Response.json({
    ok: true,
    pages,
    ordersSeen,
    ordersProcessed,
    ridersUpserted,
    membershipsUpserted,
    ticketsSkipped,
    errors: errors.slice(0, 10),
    errorCount: errors.length,
  })
}
