import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { stripe, appUrl } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/merch/checkout
//   { items: [{ productId, variantId?, quantity }], client_token? }
//
// Re-prices every line against the DB (never trusts the client), creates a
// pending merch_orders row + items, then starts a hosted Stripe Checkout with
// shipping-address collection. The webhook (kind:'merch') settles it. Kept
// entirely separate from ride `orders`.

const MAX_QTY = 20

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'bad json' }, { status: 400 }) }

  const rawItems = Array.isArray(body?.items) ? body.items : []
  if (!rawItems.length) return Response.json({ error: 'Your cart is empty.' }, { status: 400 })

  const sb = supabaseAdmin()

  // Idempotency: reuse an existing pending order for this cart session.
  const clientToken = typeof body?.client_token === 'string' ? body.client_token.slice(0, 60) : null
  if (clientToken) {
    const { data: existing } = await sb
      .from('merch_orders')
      .select('id, status, stripe_checkout_url')
      .eq('client_token', clientToken)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing?.stripe_checkout_url) {
      return Response.json({ url: existing.stripe_checkout_url })
    }
  }

  // Load the referenced products (+ variants) and re-price server-side.
  const productIds = [...new Set(rawItems.map(i => i.productId).filter(Boolean))]
  if (!productIds.length) return Response.json({ error: 'Nothing to check out.' }, { status: 400 })

  const { data: products, error: pErr } = await sb
    .from('merch_products')
    .select('id, name, price_cents, active, merch_variants(id, name, price_cents, active)')
    .in('id', productIds)
  if (pErr) return Response.json({ error: 'Could not load products.' }, { status: 500 })

  const byId = new Map((products || []).map(p => [p.id, p]))

  const lines = []
  let subtotal = 0
  for (const it of rawItems) {
    const p = byId.get(it.productId)
    if (!p || !p.active) return Response.json({ error: 'One of your items is no longer available.' }, { status: 409 })
    const qty = Math.max(1, Math.min(MAX_QTY, parseInt(it.quantity, 10) || 1))

    let unit = p.price_cents
    let name = p.name
    if (it.variantId) {
      const v = (p.merch_variants || []).find(v => v.id === it.variantId && v.active)
      if (!v) return Response.json({ error: 'A selected option is no longer available.' }, { status: 409 })
      unit = v.price_cents ?? p.price_cents
      name = `${p.name} — ${v.name}`
    }
    subtotal += unit * qty
    lines.push({ productId: p.id, variantId: it.variantId || null, name, unit, qty })
  }

  // Create the pending order + items.
  const { data: order, error: oErr } = await sb
    .from('merch_orders')
    .insert({ status: 'pending', subtotal_cents: subtotal, client_token: clientToken })
    .select('id')
    .single()
  if (oErr || !order) return Response.json({ error: 'Could not start your order.' }, { status: 500 })

  const { error: iErr } = await sb
    .from('merch_order_items')
    .insert(lines.map(l => ({
      merch_order_id: order.id,
      product_id: l.productId,
      variant_id: l.variantId,
      name: l.name,
      unit_price_cents: l.unit,
      quantity: l.qty,
    })))
  if (iErr) return Response.json({ error: 'Could not save your order.' }, { status: 500 })

  const base = appUrl(req.headers.get('origin'))

  let session
  try {
    session = await stripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 600, currency: 'usd' },
            display_name: 'Standard shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 10 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Grab it on the shuttle (free)',
          },
        },
      ],
      line_items: lines.map(l => ({
        quantity: l.qty,
        price_data: {
          currency: 'usd',
          unit_amount: l.unit,
          product_data: { name: l.name },
        },
      })),
      metadata: { kind: 'merch', merch_order_id: order.id },
      success_url: `${base}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cart`,
    })
  } catch (err) {
    console.error('[merch/checkout] stripe session failed', err)
    return Response.json({ error: 'Payment could not start. Try again.' }, { status: 502 })
  }

  await sb
    .from('merch_orders')
    .update({ stripe_checkout_session_id: session.id, stripe_checkout_url: session.url })
    .eq('id', order.id)

  return Response.json({ url: session.url })
}
