import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  const rawBody = await req.text()

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const eventType = String(body.event || body.type || 'unknown').toLowerCase()
  const externalId = body.payload?.id || body.id || null

  const { data: logRow } = await supabase
    .from('webhook_events')
    .insert({
      source: 'ticket_tailor',
      event_type: eventType,
      external_id: externalId,
      payload: body,
      status: 'received',
    })
    .select('id')
    .single()

  const logId = logRow?.id

  async function markProcessed(status, error) {
    if (!logId) return
    await supabase
      .from('webhook_events')
      .update({ status, error: error ? String(error).slice(0, 2000) : null, processed_at: new Date().toISOString() })
      .eq('id', logId)
  }

  try {
    let handled = true
    if (eventType === 'order.created' || eventType === 'order.updated') {
      await handleOrder(supabase, body.payload)
    } else if (eventType === 'issued_ticket.voided' || eventType === 'ticket.voided') {
      await handleVoidedTicket(supabase, body.payload)
    } else {
      handled = false
    }

    await markProcessed(handled ? 'ok' : 'ignored')
    return Response.json({ received: true })
  } catch (err) {
    console.error('[ticket-tailor-webhook] error', err)
    await markProcessed('error', err?.message || err)
    return Response.json({ received: true, warning: 'processing_error' })
  }
}

async function handleOrder(supabase, order) {
  if (!order) return

  const buyer = order.buyer_details || {}
  const firstName = buyer.first_name || splitName(buyer.name).first || ''
  const lastName = buyer.last_name || splitName(buyer.name).last || ''
  const email = normalizeEmail(buyer.email)
  const phone = normalizePhone(buyer.phone)

  const tickets = Array.isArray(order.issued_tickets) && order.issued_tickets.length
    ? order.issued_tickets
    : (Array.isArray(order.tickets) ? order.tickets : [])

  if (!tickets.length) {
    console.warn('[ticket-tailor-webhook] order has no tickets', order.id)
    return
  }

  for (const ticket of tickets) {
    if (ticket.status && ticket.status !== 'valid') continue

    const group = await upsertGroupForTicket(supabase, ticket, order)
    const contact = await upsertContact(supabase, {
      firstName: ticket.first_name || firstName,
      lastName: ticket.last_name || lastName,
      email: normalizeEmail(ticket.email) || email,
      phone: normalizePhone(ticket.phone) || phone,
      ticketType: ticket.description || null,
      orderId: order.id || null,
      ticketId: ticket.id || null,
      smsConsent: readSmsConsent(buyer),
    })

    if (!contact || !group) continue

    await supabase
      .from('group_members')
      .upsert(
        { group_id: group.id, contact_id: contact.id },
        { onConflict: 'group_id,contact_id', ignoreDuplicates: true }
      )
  }
}

async function handleVoidedTicket(supabase, payload) {
  const ticketId = payload?.id
  if (!ticketId) return

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('last_ticket_id', ticketId)
    .maybeSingle()

  if (!contact) return

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('tt_event_id', payload.event_id)
    .maybeSingle()

  if (group) {
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('contact_id', contact.id)
  }
}

async function upsertGroupForTicket(supabase, ticket, order) {
  const eventId = ticket.event_id || order.event_summary?.event_id || order.event_summary?.id
  if (!eventId) return null

  const pickupLabel = ticket.description || order.event_summary?.name || 'Pickup'
  const startIso = order.event_summary?.start_date?.iso
  const eventDate = startIso ? startIso.slice(0, 10) : null
  const pickupTime = startIso
    ? new Date(startIso).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Indiana/Indianapolis',
      })
    : null

  const name = eventDate
    ? `${pickupLabel} — ${formatDate(eventDate)}`
    : pickupLabel

  const { data: existing } = await supabase
    .from('groups')
    .select('id')
    .eq('tt_event_id', eventId)
    .maybeSingle()

  if (existing) return existing

  const { data: inserted, error } = await supabase
    .from('groups')
    .insert({
      tt_event_id: eventId,
      name,
      pickup_time: pickupTime,
      event_date: eventDate,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[ticket-tailor-webhook] group insert failed', error)
    return null
  }
  return inserted
}

async function upsertContact(supabase, r) {
  if (!r.phone && !r.email) return null

  const conflictTarget = r.phone ? 'phone' : 'email'
  const row = {
    first_name: r.firstName || '',
    last_name: r.lastName || '',
    email: r.email,
    phone: r.phone,
    ticket_type: r.ticketType,
    last_tt_order_id: r.orderId,
    last_ticket_id: r.ticketId,
    sms_consent: r.smsConsent,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('contacts')
    .upsert(row, { onConflict: conflictTarget })
    .select('id')
    .single()

  if (error) {
    console.error('[ticket-tailor-webhook] contact upsert failed', error)
    return null
  }
  return data
}

function normalizeEmail(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim().toLowerCase()
  return trimmed || null
}

function splitName(full) {
  if (!full) return { first: '', last: '' }
  const parts = String(full).trim().split(/\s+/)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
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

function readSmsConsent(buyer) {
  const questions = buyer?.custom_questions || []
  const consent = questions.find(q => /sms/i.test(q?.question || ''))
  if (!consent) return false
  return /yes|y|true|1|consent|agree/i.test(String(consent.answer || ''))
}
