import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createBookingCheckoutSession } from '@/lib/stripe'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { getCurrentWaiverVersion, contactHasSignedCurrent } from '@/lib/waiver'

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

  const { event_id, buyer, riders, buyer_typed_name } = body || {}
  if (!event_id || !buyer || !Array.isArray(riders) || !riders.length) {
    return Response.json({ error: 'missing event_id, buyer, or riders' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

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
    .select('id, name, price_cents, stop_index, event_id, active')
    .in('id', ticketTypeIds)
  const ttById = new Map((ticketTypes || []).map(t => [t.id, t]))

  for (const r of riders) {
    const tt = ttById.get(r.ticket_type_id)
    if (!tt || tt.event_id !== event.id || !tt.active) {
      return Response.json({ error: 'invalid ticket_type_id' }, { status: 400 })
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
    })
    .select('id')
    .single()
  if (orderErr) {
    return Response.json({ error: `order_insert: ${orderErr.message}` }, { status: 500 })
  }

  const orderItemRows = riderContacts.map(rc => {
    const tt = ttById.get(rc.rider.ticket_type_id)
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
    return Response.json({ error: `order_items_insert: ${itemsErr.message}` }, { status: 500 })
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
    })
  } catch (err) {
    return Response.json({ error: `stripe: ${err.message}` }, { status: 500 })
  }

  await supabase
    .from('orders')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', order.id)

  return Response.json({ checkout_url: session.url, order_id: order.id })
}
