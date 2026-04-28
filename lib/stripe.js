import Stripe from 'stripe'

let _stripe = null

export function stripe() {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  _stripe = new Stripe(key)
  return _stripe
}

export function appUrl(origin) {
  // Prefer the origin of the actual request — protects against env vars that
  // were copy-pasted from a sibling project pointing at the wrong domain.
  if (origin) {
    try { return new URL(origin).origin } catch {}
  }
  return (process.env.APP_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || 'http://localhost:3000').replace(/\/$/, '')
}

// Build a Stripe Checkout session for a Brew Loop booking.
//
//   { event, items, buyer, orderId, waiverPayload }
//   - event: { id, name, event_date, pickup_time }
//   - items: [{ name, unit_price_cents, quantity }]
//   - buyer: { email, name, phone }
//   - orderId: uuid of the pending orders row (so the webhook can resolve it)
//   - waiverPayload: serialized waiver-signing payload (string, ≤500 chars)
export async function createBookingCheckoutSession({
  event, items, buyer, orderId, waiverPayload, attribution, origin,
}) {
  const base = appUrl(origin)
  const dateLabel = formatEventDateLabel(event.event_date)

  const metadata = {
    order_id: orderId,
    event_id: event.id,
    waiver_payload: waiverPayload || '',
    buyer_phone: buyer.phone || '',
    buyer_name: buyer.name || '',
  }
  if (attribution?.qr_code) metadata.qr_code = attribution.qr_code
  if (attribution?.utm_source) metadata.utm_source = attribution.utm_source
  if (attribution?.utm_medium) metadata.utm_medium = attribution.utm_medium
  if (attribution?.utm_campaign) metadata.utm_campaign = attribution.utm_campaign

  return stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: buyer.email || undefined,
    // Have Stripe collect + verify the buyer's phone on the Checkout page so
    // we always have a deliverable number for the post-payment SMS even if
    // they mistyped on our form.
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    line_items: items.map(it => ({
      quantity: it.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: it.unit_price_cents,
        product_data: {
          name: `${event.name} — ${it.name}`,
          description: dateLabel,
        },
      },
    })),
    metadata,
    success_url: `${base}/book/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/book/${event.id}`,
  })
}

export async function refundOrder(paymentIntentId, opts = {}) {
  const params = { payment_intent: paymentIntentId }
  if (opts.amount_cents && opts.amount_cents > 0) {
    params.amount = opts.amount_cents
  }
  return stripe().refunds.create(params)
}

function formatEventDateLabel(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}
