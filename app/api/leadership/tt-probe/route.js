import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Diagnostic-only — probes the TT API for the right update path. Tries:
//   PATCH /v1/event_series/{series}/default_ticket_types/{tt_id}
//   PUT   /v1/event_series/{series}/default_ticket_types/{tt_id}
//   PATCH /v1/events/{event_id}/ticket_types/{tt_id}
//   PUT   /v1/events/{event_id}/ticket_types/{tt_id}
//   PUT   /v1/ticket_types/{tt_id}  (what we're using now and 404ing on)
//
// Reports status code + first 200 chars of body for each. Whichever returns
// 200 OK is the right path to wire into syncTtForEvent.
//
// Usage:
//   fetch('/api/leadership/tt-probe?event_id=ev_8295917&ticket_type_id=tt_6359256').then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)))

const TT_BASE = 'https://api.tickettailor.com/v1'

async function authHeader() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

async function tryRequest(method, path, body) {
  const auth = await authHeader()
  if (!auth) return { method, path, error: 'no_api_key' }
  const headers = { Authorization: auth, Accept: 'application/json' }
  const init = { method, headers }
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const form = new URLSearchParams()
    for (const [k, v] of Object.entries(body)) form.set(k, String(v))
    init.body = form.toString()
  }
  try {
    const res = await fetch(`${TT_BASE}${path}`, init)
    const text = await res.text()
    return { method, path, status: res.status, body: text.slice(0, 300) }
  } catch (err) {
    return { method, path, error: String(err?.message || err) }
  }
}

export async function GET(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const url = new URL(req.url)
  const eventId = url.searchParams.get('event_id')
  const ticketTypeId = url.searchParams.get('ticket_type_id')
  if (!eventId || !ticketTypeId) {
    return Response.json({ error: 'event_id and ticket_type_id query params required' }, { status: 400 })
  }

  // First GET the event to discover the event_series id (if any).
  const auth = await authHeader()
  const eventRes = await fetch(`${TT_BASE}/events/${eventId}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })
  let eventBody = null
  try { eventBody = await eventRes.json() } catch { eventBody = null }

  const seriesId =
    eventBody?.event_series_id
    || eventBody?.event_series?.id
    || null

  // Also surface what the GET returns — keys + a sample ticket type — so we
  // can see the actual shape of the response without dumping kilobytes.
  const eventShape = {
    status: eventRes.status,
    top_keys: eventBody ? Object.keys(eventBody) : [],
    detected_series_id: seriesId,
    sample_ticket_type: Array.isArray(eventBody?.ticket_types) && eventBody.ticket_types.length
      ? { keys: Object.keys(eventBody.ticket_types[0]), id: eventBody.ticket_types[0].id }
      : null,
  }

  // Try the candidate paths, in priority order. Body uses a small bump-then-
  // restore strategy: read current quantity_total, attempt to set it to the
  // same value (no actual change to inventory).
  const currentQty = Number(
    eventBody?.ticket_types?.find(t => t.id === ticketTypeId)?.quantity_total
  ) || 13
  const body = { quantity_total: currentQty }

  const attempts = []

  // ---- Try CREATING a HOLD with event_id included (the probe above confirmed
  // POST /holds is the right path; just needs event_id). Try a few body
  // variants to discover the full required field set, then DELETE the
  // successful hold so we don't actually consume capacity.
  for (const variant of [
    { event_id: eventId, ticket_type_id: ticketTypeId, quantity: 1, name: 'probe-A' },
    { event_id: eventId, ticket_type_id: ticketTypeId, total_quantity: 1, name: 'probe-B' },
    { event_id: eventId, 'ticket_types[]': ticketTypeId, quantity: 1, name: 'probe-C' },
  ]) {
    const r = await tryRequest('POST', `/holds`, variant)
    r.variant = variant.name
    attempts.push(r)
    // If we just successfully created one, clean it up. Extract id from body.
    if (r.status >= 200 && r.status < 300) {
      try {
        const created = JSON.parse(r.body)
        if (created?.id) {
          const d = await tryRequest('DELETE', `/holds/${created.id}`)
          d.variant = `cleanup-${variant.name}`
          attempts.push(d)
        }
      } catch {}
    }
  }

  // ---- LIST endpoints (read-only confirmation that holds exist as a resource) ----
  attempts.push(await tryRequest('GET', `/holds`))
  attempts.push(await tryRequest('GET', `/events/${eventId}/holds`))

  // ---- ORIGINAL update attempts (likely all 404 per TT API behavior) ----
  if (seriesId) {
    attempts.push(await tryRequest('PATCH', `/event_series/${seriesId}/default_ticket_types/${ticketTypeId}`, body))
    attempts.push(await tryRequest('PUT', `/event_series/${seriesId}/default_ticket_types/${ticketTypeId}`, body))
    attempts.push(await tryRequest('PATCH', `/event_series/${seriesId}`, body))
  }
  attempts.push(await tryRequest('PATCH', `/events/${eventId}/ticket_types/${ticketTypeId}`, body))
  attempts.push(await tryRequest('PUT', `/events/${eventId}/ticket_types/${ticketTypeId}`, body))
  attempts.push(await tryRequest('PATCH', `/events/${eventId}`, body))
  attempts.push(await tryRequest('PUT', `/ticket_types/${ticketTypeId}`, body))
  attempts.push(await tryRequest('PATCH', `/ticket_types/${ticketTypeId}`, body))

  return Response.json({
    event_id: eventId,
    ticket_type_id: ticketTypeId,
    event_shape: eventShape,
    attempts,
    winner: attempts.find(a => a.status && a.status >= 200 && a.status < 300) || null,
  })
}
