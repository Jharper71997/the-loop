import { normalizePhone } from './phone'
import { buildDefaultSchedule, scheduleFromTicketTypes, parseTicketTypeName } from './schedule'
import { finalizeBooking } from './booking'

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

export async function handleOrder(supabase, order, opts = {}) {
  const { skipSms = false } = opts
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
  let buyerContactId = null
  let firstGroupId = null
  // Track contact + stop_index per ticket so we can mirror them into
  // order_items after the orders row is created below.
  const enrichedTickets = []

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

    // Track the buyer contact + first group for the synthetic orders row below.
    const isBuyerRow =
      (phone && normalizePhone(ticket.phone || phone) === phone) ||
      (email && normalizeEmail(ticket.email || email) === email)
    if (isBuyerRow && !buyerContactId) buyerContactId = contact.id
    if (group && !firstGroupId) firstGroupId = group.id

    const stopIdx = group ? matchStopIndex(ticket, group.schedule) : null

    enrichedTickets.push({ ticket, contact, stopIdx })

    if (!group) continue

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

  // Mirror the TT order into the `orders` table so every dashboard that reads
  // from `orders` (Tonight, Metrics, /admin/groups/[id]) counts TT sales the
  // same as native Stripe sales. Idempotent via metadata.tt_order_id.
  const orderRecord = await upsertTtOrder(supabase, {
    ttOrder: order,
    tickets,
    buyer,
    buyerContactId: buyerContactId
      // Fallback to first rider contact if we couldn't identify the buyer row
      // (e.g. buyer phone/email didn't match any ticket — rare but possible).
      || (await findAnyContactForTtOrder(supabase, order.id)),
    groupId: firstGroupId,
  })

  // Mirror each TT issued_ticket into order_items so the per-ticket check-in
  // QRs + /tickets/<code> SMS work for TT just like native Stripe. Idempotent
  // via order_items.tt_ticket_id (migration 008).
  if (orderRecord?.id && enrichedTickets.length) {
    await upsertOrderItemsFromTickets(supabase, {
      orderId: orderRecord.id,
      enrichedTickets,
    })
  }

  // Single shared post-payment side-effect: mint check-in QRs + (unless
  // backfilling) send the buyer the booking confirmation with /tickets/<code>
  // links. Same helper used by the native Stripe webhook.
  if (orderRecord?.id) {
    try {
      await finalizeBooking(supabase, orderRecord.id, { skipSms })
    } catch (err) {
      console.error('[ticketTailor] finalizeBooking failed', err)
    }
  }

  return { upserts, memberships, skippedVoid, orderId: orderRecord?.id || null }
}

async function upsertOrderItemsFromTickets(supabase, { orderId, enrichedTickets }) {
  const rows = []
  for (const { ticket, contact, stopIdx } of enrichedTickets) {
    if (!ticket?.id) continue
    rows.push({
      order_id: orderId,
      contact_id: contact?.id || null,
      rider_first_name: ticket.first_name || null,
      rider_last_name: ticket.last_name || null,
      rider_email: normalizeEmail(ticket.email),
      rider_phone: normalizePhone(ticket.phone),
      unit_price_cents: ticketPriceCents(ticket),
      stop_index: stopIdx,
      tt_ticket_id: String(ticket.id),
    })
  }
  if (!rows.length) return

  const { error } = await supabase
    .from('order_items')
    .upsert(rows, { onConflict: 'tt_ticket_id', ignoreDuplicates: false })
  if (error) {
    console.error('[ticketTailor] order_items upsert failed', error)
  }
}

function ticketPriceCents(ticket) {
  if (Number.isFinite(ticket?.total_cents)) return ticket.total_cents
  if (Number.isFinite(ticket?.price_cents)) return ticket.price_cents
  if (ticket?.total != null) return Math.round(Number(ticket.total) * 100)
  if (ticket?.price != null) return Math.round(Number(ticket.price) * 100)
  return 0
}

async function upsertTtOrder(supabase, { ttOrder, tickets, buyer, buyerContactId, groupId }) {
  const ttOrderId = ttOrder?.id
  if (!ttOrderId) return null

  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('metadata->>tt_order_id', String(ttOrderId))
    .maybeSingle()

  // Resolve event_id if the synced group has a linked sales event — makes the
  // order joinable the same way Stripe orders are, so /admin/groups/[id]
  // Revenue + Tickets-sold stats pick it up. If the group has no linked event
  // yet (TT-only group), auto-create a draft event so sales have a home.
  let eventId = null
  if (groupId) {
    eventId = await ensureEventForGroup(supabase, groupId)
  }

  const validTickets = tickets.filter(t => !t.status || t.status === 'valid')
  const totalCents = sumTicketPriceCents(ttOrder, validTickets)

  const paidAt = ttOrder.created_at || ttOrder.completed_at || new Date().toISOString()
  const fullName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim()
    || buyer.name || null

  const row = {
    contact_id: buyerContactId,
    event_id: eventId,
    total_cents: totalCents,
    status: 'paid',
    buyer_email: normalizeEmail(buyer.email),
    buyer_phone: normalizePhone(buyer.phone),
    buyer_name: fullName,
    party_size: validTickets.length || tickets.length || 1,
    paid_at: paidAt,
    metadata: {
      source: 'ticket_tailor',
      tt_order_id: String(ttOrderId),
      tt_event_id: ttOrder?.event_summary?.event_id || null,
    },
  }

  if (existing?.id) {
    const { data: updated } = await supabase
      .from('orders')
      .update(row)
      .eq('id', existing.id)
      .select('id')
      .single()
    return updated || { id: existing.id }
  }

  const { data: inserted, error } = await supabase
    .from('orders')
    .insert(row)
    .select('id')
    .single()
  if (error) {
    console.error('[ticketTailor] orders insert failed', error)
    return null
  }
  return inserted
}

async function ensureEventForGroup(supabase, groupId) {
  const { data: existing } = await supabase
    .from('events')
    .select('id')
    .eq('group_id', groupId)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, event_date, pickup_time')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return null

  // Draft status — TT is the ticket source, so we don't want /events on the
  // rider site to render a Book CTA for it. Admin views still join through.
  const { data: inserted, error } = await supabase
    .from('events')
    .insert({
      group_id: group.id,
      name: group.name || 'Jville Brew Loop',
      event_date: group.event_date,
      pickup_time: group.pickup_time || null,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) {
    console.error('[ticketTailor] events insert failed', error)
    return null
  }
  return inserted.id
}

async function findAnyContactForTtOrder(supabase, ttOrderId) {
  if (!ttOrderId) return null
  const { data } = await supabase
    .from('contacts')
    .select('id')
    .eq('last_tt_order_id', String(ttOrderId))
    .maybeSingle()
  return data?.id || null
}

function sumTicketPriceCents(order, tickets) {
  // Prefer a total if TT gave us one (in cents or dollars — fields vary).
  const topTotal = order?.total_cents
    ?? order?.total_paid_cents
    ?? (order?.total_paid != null ? Math.round(Number(order.total_paid) * 100) : null)
    ?? (order?.total != null ? Math.round(Number(order.total) * 100) : null)
  if (Number.isFinite(topTotal) && topTotal >= 0) return topTotal

  // Otherwise sum per-ticket prices. TT exposes either `total_cents` or
  // `price` (decimal dollars) depending on endpoint.
  let cents = 0
  for (const t of tickets) {
    if (Number.isFinite(t?.total_cents)) { cents += t.total_cents; continue }
    if (Number.isFinite(t?.price_cents)) { cents += t.price_cents; continue }
    if (t?.total != null) { cents += Math.round(Number(t.total) * 100); continue }
    if (t?.price != null) { cents += Math.round(Number(t.price) * 100); continue }
  }
  return cents
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
