import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { scheduleFromTicketTypes, buildDefaultSchedule } from '@/lib/schedule'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/ticket-tailor-import
//
// Pulls upcoming events from Ticket Tailor and seeds `groups` rows so the
// rider site can show a Loop on /events BEFORE the first ticket sells.
// Without this, /events is empty until the TT webhook fires from a real sale
// (chicken-and-egg). Idempotent — keyed on `groups.tt_event_id`.
//
// Auth: leadership only. Hits the TT API + writes to groups.
//
// Returns { ok, fetched, upserted, skipped, per_event: [...] }.
export async function POST() {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'TICKET_TAILOR_API_KEY not set on this environment' },
      { status: 500 }
    )
  }
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
  const supabase = supabaseAdmin()

  const todayIso = new Date().toISOString().slice(0, 10)

  let events
  try {
    events = await fetchAllEvents(auth)
  } catch (err) {
    return Response.json({ error: `tt_events_fetch: ${err?.message || err}` }, { status: 502 })
  }

  const upcoming = events.filter(ev => {
    const date = readEventDate(ev)
    if (!date) return false
    return date >= todayIso
  })

  const perEvent = []
  let upserted = 0
  let skipped = 0

  for (const ev of upcoming) {
    try {
      const result = await upsertGroupFromTtEvent(supabase, ev)
      perEvent.push({
        tt_event_id: ev.id,
        name: ev.name || null,
        event_date: readEventDate(ev),
        action: result.action,
        group_id: result.groupId,
      })
      if (result.action === 'inserted' || result.action === 'updated') upserted++
      else skipped++
    } catch (err) {
      perEvent.push({
        tt_event_id: ev.id,
        name: ev.name || null,
        action: 'error',
        error: err?.message || String(err),
      })
      skipped++
    }
  }

  return Response.json({
    ok: true,
    fetched: events.length,
    upcoming: upcoming.length,
    upserted,
    skipped,
    per_event: perEvent,
  })
}

async function fetchAllEvents(auth) {
  const all = []
  let startingAfter = null
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://api.tickettailor.com/v1/events')
    url.searchParams.set('limit', '100')
    if (startingAfter) url.searchParams.set('starting_after', startingAfter)

    const res = await fetch(url.toString(), {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[tt-import] TT API error', res.status, text.slice(0, 1000))
      throw new Error(`TT API ${res.status}: ${res.statusText || 'request failed'}`)
    }
    const data = await res.json()
    const batch = Array.isArray(data?.data) ? data.data : []
    if (!batch.length) break
    all.push(...batch)
    if (!data.links?.next) break
    startingAfter = batch[batch.length - 1]?.id
    if (!startingAfter) break
  }
  return all
}

// TT event payloads vary in shape. This is the union of fields seen in the
// /events list response and the /events/:id detail response.
function readEventDate(ev) {
  return (
    ev?.start?.date
    || ev?.start_date?.date
    || (typeof ev?.start === 'string' ? ev.start.slice(0, 10) : null)
    || null
  )
}

function readEventTime(ev) {
  return ev?.start?.time || ev?.start_date?.time || null
}

async function upsertGroupFromTtEvent(supabase, ev) {
  const ttEventId = ev.id
  if (!ttEventId) throw new Error('event missing id')

  const eventDate = readEventDate(ev)
  const pickupTimeRaw = readEventTime(ev)
  const pickupTime = formatTime(pickupTimeRaw)

  const baseName = ev.name || 'Jville Brew Loop'
  const name = eventDate ? `${baseName} — ${formatDate(eventDate)}` : baseName

  const ticketTypes = Array.isArray(ev.ticket_types) ? ev.ticket_types : []
  const ttSchedule = scheduleFromTicketTypes(ticketTypes)

  const { data: existing } = await supabase
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule')
    .eq('tt_event_id', ttEventId)
    .maybeSingle()

  if (existing) {
    const patch = {}
    if (eventDate && existing.event_date !== eventDate) patch.event_date = eventDate
    if (pickupTime && existing.pickup_time !== pickupTime) patch.pickup_time = pickupTime
    if (name && existing.name !== name) patch.name = name
    if (ttSchedule && ttSchedule.length) {
      patch.schedule = ttSchedule
    } else if (!existing.schedule && pickupTimeRaw) {
      const s = buildDefaultSchedule(pickupTimeRaw)
      if (s) patch.schedule = s
    }

    if (Object.keys(patch).length === 0) {
      return { action: 'unchanged', groupId: existing.id }
    }
    const { error } = await supabase.from('groups').update(patch).eq('id', existing.id)
    if (error) throw new Error(`groups update: ${error.message}`)
    return { action: 'updated', groupId: existing.id }
  }

  const schedule = ttSchedule && ttSchedule.length
    ? ttSchedule
    : (pickupTimeRaw ? buildDefaultSchedule(pickupTimeRaw) : null)

  const { data: inserted, error } = await supabase
    .from('groups')
    .insert({
      tt_event_id: ttEventId,
      name,
      pickup_time: pickupTime,
      event_date: eventDate,
      schedule,
    })
    .select('id')
    .single()
  if (error) throw new Error(`groups insert: ${error.message}`)
  return { action: 'inserted', groupId: inserted.id }
}

function formatTime(hhmm) {
  if (!hhmm) return null
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = ((h + 11) % 12) + 1
  const mm = String(m).padStart(2, '0')
  return `${hour12}:${mm} ${suffix}`
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
