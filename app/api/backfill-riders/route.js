import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { handleOrder } from '@/lib/ticketTailor'
import { scheduleFromTicketTypes } from '@/lib/schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TT_BASE = 'https://api.tickettailor.com/v1'
const LOOP_NAME_PATTERN = /jville brew loop/i

export async function POST() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'TICKET_TAILOR_API_KEY not set' }, { status: 500 })
  }

  const supabase = supabaseAdmin()
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')

  const eventsSynced = await syncUpcomingEvents(supabase, auth)

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
    eventsSynced,
    errors: errors.slice(0, 10),
    errorCount: errors.length,
  })
}

async function syncUpcomingEvents(supabase, auth) {
  const now = Math.floor(Date.now() / 1000)
  const url = new URL(`${TT_BASE}/events`)
  url.searchParams.set('limit', '50')
  url.searchParams.set('start_at_gte', String(now - 86400))

  const res = await fetch(url.toString(), {
    headers: { Authorization: auth, Accept: 'application/json' },
  })
  if (!res.ok) return { error: `events fetch ${res.status}`, inserted: 0, updated: 0 }

  const json = await res.json()
  const events = (json.data || []).filter(e => LOOP_NAME_PATTERN.test(e.name || ''))

  let inserted = 0
  let updated = 0

  for (const ev of events) {
    const id = ev.id
    if (!id) continue
    const start = ev.start || ev.start_date || {}
    const eventDate = start.date || null
    const pickupTime = formatTime(start.time)
    const name = eventDate ? `${ev.name} — ${formatDate(eventDate)}` : ev.name
    const schedule = scheduleFromTicketTypes(ev.ticket_types || [])

    const { data: existing } = await supabase
      .from('groups')
      .select('id, event_date, pickup_time, name, schedule')
      .eq('tt_event_id', id)
      .maybeSingle()

    if (existing) {
      const patch = {}
      if (!existing.event_date && eventDate) patch.event_date = eventDate
      if (!existing.pickup_time && pickupTime) patch.pickup_time = pickupTime
      if (!existing.name && name) patch.name = name
      if (schedule && schedule.length) patch.schedule = schedule
      if (Object.keys(patch).length) {
        await supabase.from('groups').update(patch).eq('id', existing.id)
        updated++
      }
    } else {
      const { error } = await supabase.from('groups').insert({
        tt_event_id: id,
        name,
        event_date: eventDate,
        pickup_time: pickupTime,
        schedule,
      })
      if (!error) inserted++
    }
  }

  return { inserted, updated, total: events.length }
}

function formatTime(hhmm) {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

function formatDate(iso) {
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}
