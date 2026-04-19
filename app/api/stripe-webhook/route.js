import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordSignature } from '@/lib/waiver'
import { sendBookingConfirmation } from '@/lib/sms'
import { appUrl } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = supabaseAdmin()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }

  const { data: logRow } = await supabase
    .from('webhook_events')
    .insert({
      source: 'stripe',
      event_type: event.type,
      external_id: event.id,
      payload: event,
      status: 'received',
    })
    .select('id')
    .single()
  const logId = logRow?.id

  async function markProcessed(status, error) {
    if (!logId) return
    await supabase
      .from('webhook_events')
      .update({
        status,
        error: error ? String(error).slice(0, 2000) : null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', logId)
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(supabase, event.data.object)
    } else if (event.type === 'charge.refunded' || event.type === 'refund.created') {
      await handleRefund(supabase, event.data.object)
    } else {
      await markProcessed('ignored')
      return Response.json({ received: true })
    }
    await markProcessed('ok')
    return Response.json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] error', err)
    await markProcessed('error', err?.message || err)
    return Response.json({ received: true, warning: 'processing_error' })
  }
}

async function handleCheckoutCompleted(supabase, session) {
  const orderId = session.metadata?.order_id
  if (!orderId) {
    // Likely the legacy Stripe Checkout flow with metadata.group_id — preserve it.
    return handleLegacyGroupCheckout(supabase, session)
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, contact_id, status, buyer_phone, party_size')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) throw new Error(`order ${orderId} not found`)

  if (order.status === 'paid') return

  await supabase
    .from('orders')
    .update({
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent || null,
      paid_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  const sigPayload = parseSigPayload(session.metadata?.waiver_payload)
  const sigsByContact = new Map()
  for (const s of sigPayload.sigs || []) {
    try {
      await recordSignature(supabase, {
        contactId: s.contactId,
        fullNameTyped: s.typedName,
        signedForContactId: s.signedForContactId || null,
        orderId: order.id,
      })
      sigsByContact.set(s.contactId, true)
    } catch (err) {
      console.error('[stripe-webhook] waiver signature failed', err)
    }
  }

  await supabase
    .from('waiver_signatures')
    .update({ order_id: order.id })
    .eq('order_id', null)
    .in('contact_id', [...sigsByContact.keys()])

  if (order.event_id) {
    const { data: event } = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time, group_id')
      .eq('id', order.event_id)
      .maybeSingle()

    if (event?.group_id) {
      const { data: items } = await supabase
        .from('order_items')
        .select('contact_id, stop_index')
        .eq('order_id', order.id)

      const memberRows = (items || [])
        .filter(it => it.contact_id)
        .map(it => ({
          group_id: event.group_id,
          contact_id: it.contact_id,
          ...(it.stop_index != null ? { current_stop_index: it.stop_index } : {}),
        }))

      if (memberRows.length) {
        await supabase
          .from('group_members')
          .upsert(memberRows, { onConflict: 'group_id,contact_id', ignoreDuplicates: true })
      }
    }

    if (order.buyer_phone) {
      const { data: buyerContact } = await supabase
        .from('contacts')
        .select('id, has_signed_waiver, waiver_version')
        .eq('id', order.contact_id)
        .maybeSingle()

      const waiverLink = buyerContact && !buyerContact.has_signed_waiver
        ? `${appUrl()}/waiver/${buyerContact.id}`
        : null

      try {
        await sendBookingConfirmation(order.buyer_phone, {
          buyer: { name: session.customer_details?.name || '' },
          event: event,
          waiverLink,
        })
      } catch (err) {
        console.error('[stripe-webhook] SMS failed', err)
      }
    }
  }
}

async function handleRefund(supabase, obj) {
  const paymentIntent = obj.payment_intent
  if (!paymentIntent) return
  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, status')
    .eq('stripe_payment_intent_id', paymentIntent)
    .maybeSingle()
  if (!order) return

  await supabase
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', order.id)

  if (order.event_id) {
    const { data: event } = await supabase
      .from('events')
      .select('group_id')
      .eq('id', order.event_id)
      .maybeSingle()
    if (event?.group_id) {
      const { data: items } = await supabase
        .from('order_items')
        .select('contact_id')
        .eq('order_id', order.id)
      const contactIds = (items || []).map(i => i.contact_id).filter(Boolean)
      if (contactIds.length) {
        await supabase
          .from('group_members')
          .delete()
          .eq('group_id', event.group_id)
          .in('contact_id', contactIds)
      }
    }
  }
}

async function handleLegacyGroupCheckout(supabase, session) {
  const { customer_details, metadata } = session
  const groupId = metadata?.group_id
  if (!groupId) return

  const name = customer_details?.name?.split(' ') || ['', '']
  const first_name = name[0]
  const last_name = name.slice(1).join(' ')

  const { data: contact } = await supabase
    .from('contacts')
    .insert([{
      first_name,
      last_name,
      email: customer_details?.email,
      phone: customer_details?.phone,
    }])
    .select()
    .single()

  if (contact) {
    await supabase.from('group_members').insert([{ group_id: groupId, contact_id: contact.id }])
  }
}

function parseSigPayload(raw) {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}
