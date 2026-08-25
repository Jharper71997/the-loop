// Loop Pass — recurring rider subscription helpers.
//
// Pricing lives in Stripe (recurring Prices). Set the price ids in env:
//   STRIPE_LOOP_PASS_MONTHLY_PRICE_ID
//   STRIPE_LOOP_PASS_SEASON_PRICE_ID
// The blurb/label below are display-only; the real amount is shown by Stripe
// Checkout, so the page never hardcodes a dollar figure that could drift.

export const PASS_PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly Pass',
    envKey: 'STRIPE_LOOP_PASS_MONTHLY_PRICE_ID',
    blurb: 'Ride every weekend loop, billed monthly. Cancel anytime.',
  },
  season: {
    id: 'season',
    label: 'Season Pass',
    envKey: 'STRIPE_LOOP_PASS_SEASON_PRICE_ID',
    blurb: 'One payment covers the whole season of loops.',
  },
}

// Map a Stripe subscription status onto the three states the app cares about.
export function mapSubStatus(s) {
  if (s === 'active' || s === 'trialing') return 'active'
  if (s === 'past_due' || s === 'unpaid' || s === 'incomplete') return 'past_due'
  return 'canceled' // canceled, incomplete_expired, paused, …
}

// Return the contact's live pass row, or null. Used at booking time to decide
// whether a rider's seat is covered by their pass.
export async function getActivePass(supabase, contactId) {
  if (!contactId) return null
  const { data } = await supabase
    .from('loop_passes')
    .select('id, plan, status, current_period_end')
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}
