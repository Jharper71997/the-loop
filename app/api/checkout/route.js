import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createBookingCheckoutSession } from '@/lib/stripe'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { getCurrentWaiverVersion, contactHasSignedCurrent } from '@/lib/waiver'

function mintClaimToken() {
  // 24 bytes => 32 url-safe base64 chars. Long enough that brute-forcing
  // an unclaimed token is computationally infeasible; short enough to copy
  // into a text message without wrapping.
  return randomBytes(24).toString('base64url')
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/checkout
// Body:
// {
//   event_id: uuid,
//   buyer: { first_name, last_name, email, phone, sms_consent },
//   riders: [
//     {
//       ticket_type_id: uuid,
//       first_name, last_name, email, phone,
//       signed_self: bool,           // rider is signing themselves
//       signed_by_buyer: bool,       // buyer is signing on this rider's behalf
//       typed_name: string           // typed signature (required unless already on file)
//     }, ...
//   ],
//   buyer_typed_name: string          // required if buyer or any rider is signing
// }
export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { event_id, buyer, riders, buyer_typed_name, client_token } = body || {}
  if (!event_id || !buyer || !Array.isArray(riders) || !riders.length) {
    return Response.json({ error: 'missing event_id, buyer, or riders' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  // Idempotent retry: if the rider double-taps Pay or the network retries the
  // POST, the same client_token replays the same Stripe URL instead of
  // creating a second order + second Checkout session.
  if (client_token) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id, stripe_checkout_url, status, created_at')
      .eq('event_id', event_id)
      .eq('client_token', client_token)
      .maybeSingle()
    if (existing?.stripe_checkout_url) {
      return Response.json({
        checkout_url: existing.stripe_checkout_url,
        order_id: existing.id,
        replayed: true,
      })
    }
    if (existing) {
      // No URL yet. If the row is fresh, the first request is still mid-flight
      // — ask the client to wait. If it's older than 30s the Stripe call
      // almost certainly failed (the row would be unrecoverable otherwise),
      // so wipe it and fall through to a clean retry.
      const ageMs = Date.now() - new Date(existing.created_at).getTime()
      if (ageMs < 30_000) {
        return Response.json({ error: 'in_flight_retry' }, { status: 409 })
      }
      await supabase.from('orders').delete().eq('id', existing.id)
    }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date, pickup_time, status, group_id')
    .eq('id', event_id)
    .maybeSingle()
  if (!event) return Response.json({ error: 'event not found' }, { status: 404 })
  if (event.status !== 'on_sale') {
    return Response.json({ error: `event_not_on_sale_${event.status}` }, { status: 400 })
  }

  const ticketTypeIds = [...new Set(riders.map(r => r.ticket_type_id).filter(Boolean))]
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('id, name, price_cents, stop_index, capacity, event_id, active')
    .in('id', ticketTypeIds)
  const ttById = new Map((ticketTypes || []).map(t => [t.id, t]))

  for (const r of riders) {
    const tt = ttById.get(r.ticket_type_id)
    if (!tt || tt.event_id !== event.id || !tt.active) {
      return Response.json({ error: 'invalid ticket_type_id' }, { status: 400 })
    }
  }

  // Per-ticket-type capacity check. Counts already-paid orders + recent
  // pendings (< 1 hour old, the typical Stripe Checkout window) against the
  // configured ticket_types.capacity. Tickets with capacity = null are
  // unlimited.
  const requestedByType = new Map()
  for (const r of riders) {
    requestedByType.set(r.ticket_type_id, (requestedByType.get(r.ticket_type_id) || 0) + 1)
  }
  const pendingCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  for (const [ttId, requested] of requestedByType.entries()) {
    const tt = ttById.get(ttId)
    if (tt.capacity == null) continue

    const { count: paidCount } = await supabase
      .from('order_items')
      .select('id, orders!inner(id, status)', { count: 'exact', head: true })
      .eq('ticket_type_id', ttId)
      .eq('orders.status', 'paid')
    const { count: pendingCount } = await supabase
      .from('order_items')
      .select('id, orders!inner(id, status, created_at)', { count: 'exact', head: true })
      .eq('ticket_type_id', ttId)
      .eq('orders.status', 'pending')
      .gte('orders.created_at', pendingCutoff)

    const taken = (paidCount || 0) + (pendingCount || 0)
    if (taken + requested > tt.capacity) {
      return Response.json({
        error: 'sold_out',
        ticket_type_id: ttId,
        ticket_type_name: tt.name,
        remaining: Math.max(0, tt.capacity - taken),
        requested,
      }, { status: 409 })
    }
  }

  const currentWaiver = await getCurrentWaiverVersion(supabase)
  if (!currentWaiver) {
    return Response.json({ error: 'waiver_not_configured' }, { status: 500 })
  }

  const buyerContact = await upsertContactByPhoneOrEmail(supabase, {
    firstName: buyer.first_name,
    lastName: buyer.last_name,
    email: buyer.email,
    phone: buyer.phone,
    smsConsent: !!buyer.sms_consent,
  })
  if (!buyerContact) {
    return Response.json({ error: 'buyer missing phone and email' }, { status: 400 })
  }

  const riderContacts = []
  for (const r of riders) {
    // Claim-link riders skip contact lookup entirely — the friend creates
    // their own contact when they open the claim URL.
    if (r.claim_link) {
      riderContacts.push({ rider: r, contact: null, claim: true })
      continue
    }

    const riderIsBuyer =
      (r.phone && normalizePhone(r.phone) === normalizePhone(buyer.phone)) ||
      (r.email && normalizeEmail(r.email) === normalizeEmail(buyer.email))

    let contact
    if (riderIsBuyer) {
      contact = buyerContact
    } else {
      contact = await upsertContactByPhoneOrEmail(supabase, {
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        phone: r.phone,
      })
      if (!contact) {
        return Response.json({ error: 'rider missing phone and email' }, { status: 400 })
      }
    }
    riderContacts.push({ rider: r, contact })
  }

  const waiverQueue = []
  for (const rc of riderContacts) {
    if (rc.claim) continue // friend will sign at /c/<token>
    const alreadySigned = await contactHasSignedCurrent(supabase, rc.contact.id)
    if (alreadySigned) continue

    if (rc.rider.signed_self) {
      const typed = (rc.rider.typed_name || '').trim()
      if (!typed) return Response.json({ error: 'missing typed_name for rider signing self' }, { status: 400 })
      waiverQueue.push({
        contactId: rc.contact.id,
        typedName: typed,
        signedForContactId: null,
      })
    } else if (rc.rider.signed_by_buyer) {
      const typed = (buyer_typed_name || '').trim()
      if (!typed) return Response.json({ error: 'missing buyer_typed_name for group signing' }, { status: 400 })
      waiverQueue.push({
        contactId: rc.contact.id,
        typedName: typed,
        signedForContactId: buyerContact.id,
      })
    } else {
      return Response.json({
        error: 'unsigned_rider',
        contact_id: rc.contact.id,
        message: 'Every rider must either sign themselves or be signed for by the buyer',
      }, { status: 400 })
    }
  }

  const totalCents = riders.reduce((s, r) => s + (ttById.get(r.ticket_type_id)?.price_cents || 0), 0)

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      contact_id: buyerContact.id,
      event_id: event.id,
      total_cents: totalCents,
      status: 'pending',
      buyer_email: normalizeEmail(buyer.email),
      buyer_phone: normalizePhone(buyer.phone),
      buyer_name: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim(),
      party_size: riders.length,
      client_token: client_token || null,
    })
    .select('id')
    .single()
  if (orderErr) {
    // 23505 = unique violation on (event_id, client_token). Race between two
    // simultaneous POSTs; the loser replays the winner's checkout URL.
    if (orderErr.code === '23505' && client_token) {
      const { data: winner } = await supabase
        .from('orders')
        .select('id, stripe_checkout_url')
        .eq('event_id', event.id)
        .eq('client_token', client_token)
        .maybeSingle()
      if (winner?.stripe_checkout_url) {
        return Response.json({
          checkout_url: winner.stripe_checkout_url,
          order_id: winner.id,
          replayed: true,
        })
      }
      return Response.json({ error: 'in_flight_retry' }, { status: 409 })
    }
    console.error('[checkout] order insert failed', orderErr)
    return Response.json({ error: 'order_insert_failed' }, { status: 500 })
  }

  const orderItemRows = riderContacts.map(rc => {
    const tt = ttById.get(rc.rider.ticket_type_id)
    if (rc.claim) {
      // Claim-link item: friend hasn't filled their info yet. Mint an
      // unguessable token they'll use at /c/<token>.
      return {
        order_id: order.id,
        ticket_type_id: tt.id,
        contact_id: null,
        rider_first_name: '',
        rider_last_name: '',
        rider_email: null,
        rider_phone: null,
        unit_price_cents: tt.price_cents,
        stop_index: tt.stop_index,
        claim_token: mintClaimToken(),
      }
    }
    return {
      order_id: order.id,
      ticket_type_id: tt.id,
      contact_id: rc.contact.id,
      rider_first_name: rc.rider.first_name || '',
      rider_last_name: rc.rider.last_name || '',
      rider_email: normalizeEmail(rc.rider.email),
      rider_phone: normalizePhone(rc.rider.phone),
      unit_price_cents: tt.price_cents,
      stop_index: tt.stop_index,
    }
  })
  const { error: itemsErr } = await supabase.from('order_items').insert(orderItemRows)
  if (itemsErr) {
    console.error('[checkout] order_items insert failed', itemsErr)
    return Response.json({ error: 'order_items_insert_failed' }, { status: 500 })
  }

  // Belt-and-suspenders capacity recheck. The pre-insert check is racy across
  // simultaneous buyers (two reads see the same "remaining"). If the race lost
  // and we just oversold a ticket type, undo this order before handing off to
  // Stripe so the buyer sees sold_out instead of paying for a seat we can't
  // honor.
  for (const [ttId, requested] of requestedByType.entries()) {
    const tt = ttById.get(ttId)
    if (tt.capacity == null) continue
    const { count: paidCount } = await supabase
      .from('order_items')
      .select('id, orders!inner(id, status)', { count: 'exact', head: true })
      .eq('ticket_type_id', ttId)
      .eq('orders.status', 'paid')
    const { count: pendingCount } = await supabase
      .from('order_items')
      .select('id, orders!inner(id, status, created_at)', { count: 'exact', head: true })
      .eq('ticket_type_id', ttId)
      .eq('orders.status', 'pending')
      .gte('orders.created_at', pendingCutoff)
    const taken = (paidCount || 0) + (pendingCount || 0)
    if (taken > tt.capacity) {
      // Undo: cascade-deletes order_items, frees the slot back up.
      await supabase.from('orders').delete().eq('id', order.id)
      return Response.json({
        error: 'sold_out',
        ticket_type_id: ttId,
        ticket_type_name: tt.name,
        remaining: 0,
        requested,
      }, { status: 409 })
    }
  }

  const sessionLineItems = []
  const byType = new Map()
  for (const r of riders) {
    byType.set(r.ticket_type_id, (byType.get(r.ticket_type_id) || 0) + 1)
  }
  for (const [ttId, qty] of byType.entries()) {
    const tt = ttById.get(ttId)
    sessionLineItems.push({ name: tt.name, unit_price_cents: tt.price_cents, quantity: qty })
  }

  let session
  try {
    session = await createBookingCheckoutSession({
      event,
      items: sessionLineItems,
      buyer: {
        email: normalizeEmail(buyer.email),
        name: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim(),
        phone: normalizePhone(buyer.phone),
      },
      orderId: order.id,
      waiverPayload: JSON.stringify({ sigs: waiverQueue }),
      attribution: body.attribution || null,
      origin: req.headers.get('origin') || req.headers.get('referer'),
    })
  } catch (err) {
    return Response.json({ error: `stripe: ${err.message}` }, { status: 500 })
  }

  await supabase
    .from('orders')
    .update({
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
    })
    .eq('id', order.id)

  return Response.json({ checkout_url: session.url, order_id: order.id })
}
