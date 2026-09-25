import PassClient from './PassClient'
import { PASS_PLANS } from '@/lib/loopPass'
import { stripe } from '@/lib/stripe'

export const metadata = {
  title: 'Loop Pass — Jville Brew Loop',
  description: 'Ride every weekend loop with a Loop Pass.',
}

// The price shown here is read from the Stripe Price the checkout will charge,
// so what the page says and what the card is charged cannot drift apart. If
// Stripe cannot be reached, the plan renders without a price and the form
// refuses to start checkout: never sell a subscription without showing the
// amount and the renewal terms first.
export const dynamic = 'force-dynamic'

async function priceFor(priceId) {
  try {
    const p = await stripe().prices.retrieve(priceId)
    if (!p?.unit_amount || !p?.recurring?.interval) return null
    const count = p.recurring.interval_count || 1
    return {
      amountCents: p.unit_amount,
      currency: (p.currency || 'usd').toUpperCase(),
      interval: p.recurring.interval, // day | week | month | year
      intervalCount: count,
    }
  } catch (err) {
    console.error('[pass] price lookup failed', err?.message || err)
    return null
  }
}

export default async function PassPage() {
  // Only offer plans that have a Stripe price configured, so a half-set-up
  // plan never shows a dead button.
  const configured = Object.values(PASS_PLANS).filter(p => !!process.env[p.envKey])
  const plans = await Promise.all(configured.map(async p => ({
    id: p.id,
    label: p.label,
    blurb: p.blurb,
    price: await priceFor(process.env[p.envKey]),
  })))

  return <PassClient plans={plans} />
}
