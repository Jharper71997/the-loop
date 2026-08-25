import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/waitlist
// Body: { event_id, ticket_type_id?, stop_index?, first_name, last_name, phone, email, party_size }
// Records overflow demand when a stop is sold out. Best-effort contact upsert so
// the rider links to their existing record; the waitlist row stands on its own
// even if the contact upsert fails.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const eventId = String(body?.event_id || '').trim()
  const firstName = String(body?.first_name || '').trim()
  const lastName = String(body?.last_name || '').trim()
  const email = normalizeEmail(body?.email)
  const phone = normalizePhone(body?.phone)
  const partySize = Math.max(1, Math.min(20, parseInt(body?.party_size, 10) || 1))

  if (!eventId) return bad('event_id required')
  if (!firstName) return bad('Please add your name.')
  if (!phone && !email) return bad('Add a phone or email so we can reach you if a seat opens.')

  const supabase = supabaseAdmin()

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return bad('event not found', 404)

  let contactId = null
  try {
    const contact = await upsertContactByPhoneOrEmail(supabase, { firstName, lastName, email, phone })
    contactId = contact?.id || null
  } catch (err) {
    console.error('[waitlist] contact upsert failed', err)
  }

  const stopIndexRaw = body?.stop_index
  const stopIndex = Number.isFinite(parseInt(stopIndexRaw, 10)) ? parseInt(stopIndexRaw, 10) : null
  const ticketTypeId = body?.ticket_type_id ? String(body.ticket_type_id) : null

  const { error } = await supabase.from('event_waitlist').insert({
    event_id: eventId,
    ticket_type_id: ticketTypeId,
    stop_index: stopIndex,
    contact_id: contactId,
    first_name: firstName,
    last_name: lastName || null,
    email: email || null,
    phone: phone || null,
    party_size: partySize,
  })
  if (error) {
    console.error('[waitlist] insert failed', error)
    return Response.json({ error: 'could_not_join' }, { status: 500 })
  }

  return Response.json({ ok: true })
}

function bad(msg, status = 400) {
  return Response.json({ error: msg }, { status })
}
