import { normalizePhone } from './phone'

export async function handleOrder(supabase, order) {
  if (!order) return { skipped: 'no_order' }

  if (order.status && order.status !== 'completed') {
    return { skipped: `order_status_${order.status}` }
  }

  const buyer = order.buyer_details || {}
  const firstName = buyer.first_name || splitName(buyer.name).first || ''
  const lastName = buyer.last_name || splitName(buyer.name).last || ''
  const email = normalizeEmail(buyer.email)
  const phone = normalizePhone(buyer.phone)

  const tickets = Array.isArray(order.issued_tickets) && order.issued_tickets.length
    ? order.issued_tickets
    : (Array.isArray(order.tickets) ? order.tickets : [])

  if (!tickets.length) return { skipped: 'no_tickets' }

  let upserts = 0
  let memberships = 0
  let skippedVoid = 0

  for (const ticket of tickets) {
    if (ticket.status && ticket.status !== 'valid') {
      skippedVoid++
      continue
    }

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

    if (!contact) continue
    upserts++

    if (!group) continue
    const { error: memberErr } = await supabase
      .from('group_members')
      .upsert(
        { group_id: group.id, contact_id: contact.id },
        { onConflict: 'group_id,contact_id', ignoreDuplicates: true }
      )
    if (!memberErr) memberships++
  }

  return { upserts, memberships, skippedVoid }
}

export async function handleVoidedTicket(supabase, payload) {
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
  const start = order.event_summary?.start_date || {}
  const eventDate = start.date || null
  const pickupTime = formatTime(start.time)
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
    console.error('[ticketTailor] group insert failed', error)
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
    console.error('[ticketTailor] contact upsert failed', error)
    const err = new Error(`contact upsert failed: ${error.message || error.code || 'unknown'}`)
    err.detail = error
    throw err
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

function readSmsConsent(buyer) {
  const questions = buyer?.custom_questions || []
  const consent = questions.find(q => /sms/i.test(q?.question || ''))
  if (!consent) return false
  return /yes|y|true|1|consent|agree/i.test(String(consent.answer || ''))
}
