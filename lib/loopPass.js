// Loop Pass — recurring rider subscription helpers.
//
// Pricing lives in Stripe (recurring Prices). Set the price ids in env:
//   STRIPE_LOOP_PASS_MONTHLY_PRICE_ID
//   STRIPE_LOOP_PASS_SEASON_PRICE_ID
// The blurb/label below are display-only; the real amount is shown by Stripe
// Checkout, so the page never hardcodes a dollar figure that could drift.

import { stripe } from './stripe'
import { normalizePhone } from './phone'

export const PASS_PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly Pass',
    envKey: 'STRIPE_LOOP_PASS_MONTHLY_PRICE_ID',
    blurb: 'Ride every weekend loop. Renews monthly until you cancel.',
  },
  season: {
    id: 'season',
    label: 'Season Pass',
    envKey: 'STRIPE_LOOP_PASS_SEASON_PRICE_ID',
    // Checkout uses a RECURRING yearly price (mode: 'subscription'), so this
    // auto-renews. Never describe it as a one-time payment.
    blurb: 'Ride every weekend loop. Billed once a year, renews yearly until you cancel.',
  },
}

// Map a Stripe subscription status onto the three states the app cares about.
export function mapSubStatus(s) {
  if (s === 'active' || s === 'trialing') return 'active'
  if (s === 'past_due' || s === 'unpaid' || s === 'incomplete') return 'past_due'
  return 'canceled' // canceled, incomplete_expired, paused, …
}

// Return the contact's live pass row, or null. This is only the local mirror;
// verifyPassForRide is what decides whether a seat is actually covered.
export async function getActivePass(supabase, contactId) {
  if (!contactId) return null
  const { data } = await supabase
    .from('loop_passes')
    .select('id, plan, status, current_period_end, stripe_subscription_id')
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

// Decide whether a Loop Pass covers this rider's seat on this event. Checked
// live against Stripe at booking time, never just the local mirror, because a
// missed webhook would otherwise leave an unpaid pass riding free.
//
// A seat is covered only when ALL of these hold:
//   1. Stripe says the subscription is active and its latest invoice is PAID
//      (a trial or an unpaid renewal does not count).
//   2. The paid period runs through the ride date. A ride after the period
//      ends has to wait for the renewal to actually go through.
//   3. The rider AND the buyer are on the phone number the pass was bought
//      with, so the ticket and boarding pass only ever text the holder.
//   4. The holder has no other seat on this event already. One pass, one
//      seat per loop, across all orders.
//
// Returns { covered: true, holderName, subscriptionId } or
// { covered: false, reason }. reason 'verify_failed' means Stripe could not be
// reached; the caller must not treat that as a paid seat.
export async function verifyPassForRide(supabase, { contactId, riderPhone, buyerPhone, eventId, eventDate }) {
  const pass = await getActivePass(supabase, contactId)
  if (!pass?.stripe_subscription_id) return { covered: false, reason: 'no_pass' }

  let sub, session
  try {
    const s = stripe()
    ;[sub, session] = await Promise.all([
      s.subscriptions.retrieve(pass.stripe_subscription_id, { expand: ['latest_invoice'] }),
      s.checkout.sessions.list({ subscription: pass.stripe_subscription_id, limit: 1 })
        .then(r => r.data?.[0] || null),
    ])
  } catch (err) {
    console.error('[loopPass] stripe verify failed', err)
    return { covered: false, reason: 'verify_failed' }
  }

  if (sub?.status !== 'active') return { covered: false, reason: 'not_active' }
  const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null
  if (invoice?.status !== 'paid') return { covered: false, reason: 'unpaid' }

  // Newer Stripe API versions moved the period onto the subscription item.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
  if (!periodEnd || !eventDate) return { covered: false, reason: 'no_period' }
  // End of the ride day in Eastern time (EST offset is the later of the two).
  const rideEnds = new Date(`${eventDate}T23:59:59-05:00`).getTime()
  if (periodEnd * 1000 < rideEnds) return { covered: false, reason: 'period_ends_before_ride' }

  const holderPhone = normalizePhone(sub.metadata?.holder_phone || session?.metadata?.buyer_phone)
  if (!holderPhone) return { covered: false, reason: 'no_holder_phone' }
  if (normalizePhone(riderPhone) !== holderPhone || normalizePhone(buyerPhone) !== holderPhone) {
    return { covered: false, reason: 'phone_mismatch' }
  }

  // Any live seat for the holder on this event (paid, or pending and still
  // inside the checkout window) means the pass is already used for this loop.
  const pendingCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: existing } = await supabase
    .from('order_items')
    .select('id, orders!inner(status, created_at, event_id)')
    .eq('contact_id', contactId)
    .eq('orders.event_id', eventId)
    .is('voided_at', null)
    .or(`status.eq.paid,and(status.eq.pending,created_at.gte."${pendingCutoff}")`, { referencedTable: 'orders' })
    .limit(1)
  if (existing?.length) return { covered: false, reason: 'already_booked' }

  const holderName = (sub.metadata?.holder_name || session?.customer_details?.name || '').trim() || null
  return { covered: true, holderName, subscriptionId: sub.id }
}
