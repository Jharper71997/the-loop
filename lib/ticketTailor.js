import { normalizePhone } from './phone'
import { buildDefaultSchedule, scheduleFromTicketTypes, parseTicketTypeName } from './schedule'

function matchStopIndex(ticket, schedule) {
  if (!Array.isArray(schedule) || !schedule.length) return null
  const parsed = parseTicketTypeName(ticket?.description || ticket?.name || '')
  if (!parsed) return null
  const target = parsed.name.toLowerCase().trim()
  const idx = schedule.findIndex(s => String(s.name || '').toLowerCase().trim() === target)
  return idx >= 0 ? idx : null
}

const TT_BASE = 'https://api.tickettailor.com/v1'
const eventScheduleCache = new Map()

async function fetchTTEventSchedule(eventId) {
  if (!eventId) return null
  if (eventScheduleCache.has(eventId)) return eventScheduleCache.get(eventId)
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  try {
    const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
    const res = await fetch(`${TT_BASE}/events/${eventId}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (!res.ok) {
      eventScheduleCache.set(eventId, null)
      return null
    }
    const data = await res.json()
    const schedule = scheduleFromTicketTypes(data.ticket_types || [])
    eventScheduleCache.set(eventId, schedule)
    return schedule
  } catch {
    eventScheduleCache.set(eventId, null)
    return null
  }
}

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

    const stopIdx = matchStopIndex(ticket, group.schedule)

    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id, current_stop_index')
      .eq('group_id', group.id)
      .eq('contact_id', contact.id)
      .maybeSingle()

    if (existingMember) {
      if (existingMember.current_stop_index == null && stopIdx != null) {
        await supabase
          .from('group_members')
          .update({ current_stop_index: stopIdx })
          .eq('id', existingMember.id)
      }
      memberships++
      continue
    }

    const row = { group_id: group.id, contact_id: contact.id }
    if (stopIdx != null) row.current_stop_index = stopIdx

    const { error: memberErr } = await supabase
      .from('group_members')
      .insert(row)

    if (memberErr) {
      throw new Error(`group_members insert failed: ${memberErr.message || memberErr.code}`)
    }
    memberships++
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

  const eventName = order.event_summary?.name || 'Jville Brew Loop'
  const start = order.event_summary?.start_date || {}
  const eventDate = start.date || null
  const pickupTime = formatTime(start.time)
  const name = eventDate ? `${eventName} — ${formatDate(eventDate)}` : eventName

  const { data: existing } = await supabase
    .from('groups')
    .select('id, schedule, event_date, name, pickup_time')
    .eq('tt_event_id', eventId)
    .maybeSingle()

  const ttSchedule = await fetchTTEventSchedule(eventId)

  if (existing) {
    const patch = {}
    if (!existing.event_date && eventDate) patch.event_date = eventDate
    if (!existing.pickup_time && pickupTime) patch.pickup_time = pickupTime
    if (name && existing.name !== name) patch.name = name
    if (ttSchedule && ttSchedule.length) {
      patch.schedule = ttSchedule
    } else if (!existing.schedule && start.time) {
      const schedule = buildDefaultSchedule(start.time, firstStopName(ticket))
      if (schedule) patch.schedule = schedule
    }
    if (Object.keys(patch).length) {
      await supabase.from('groups').update(patch).eq('id', existing.id)
    }
    return { ...existing, ...patch }
  }

  const schedule = ttSchedule && ttSchedule.length
    ? ttSchedule
    : (start.time ? buildDefaultSchedule(start.time, firstStopName(ticket)) : null)

  const { data: inserted, error } = await supabase
    .from('groups')
    .insert({
      tt_event_id: eventId,
      name,
      pickup_time: pickupTime,
      event_date: eventDate,
      schedule,
    })
    .select('id, schedule')
    .single()

  if (error) {
    console.error('[ticketTailor] group insert failed', error)
    return null
  }
  return inserted
}

async function upsertContact(supabase, r) {
  if (!r.phone && !r.email) return null

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

  let existing = null
  if (r.phone) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', r.phone)
      .maybeSingle()
    existing = data
  }
  if (!existing && r.email) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', r.email)
      .maybeSingle()
    existing = data
  }

  if (existing) {
    const { error } = await supabase
      .from('contacts')
      .update(row)
      .eq('id', existing.id)
    if (error) throw new Error(`contact update failed: ${error.message || error.code}`)
    return existing
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`contact insert failed: ${error.message || error.code}`)
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

function firstStopName(ticket) {
  const desc = ticket?.description
  if (!desc) return 'Stop 1'
  return String(desc).split(/ - /)[0].trim() || 'Stop 1'
}

function readSmsConsent(buyer) {
  const questions = buyer?.custom_questions || []
  const consent = questions.find(q => /sms/i.test(q?.question || ''))
  if (!consent) return false
  return /yes|y|true|1|consent|agree/i.test(String(consent.answer || ''))
}
