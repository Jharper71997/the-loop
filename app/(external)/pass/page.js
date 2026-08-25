import PassClient from './PassClient'
import { PASS_PLANS } from '@/lib/loopPass'

export const metadata = {
  title: 'Loop Pass — Jville Brew Loop',
  description: 'Ride every weekend loop with a Loop Pass.',
}

export default function PassPage() {
  // Only offer plans that have a Stripe price configured, so a half-set-up
  // plan never shows a dead button.
  const plans = Object.values(PASS_PLANS)
    .filter(p => !!process.env[p.envKey])
    .map(p => ({ id: p.id, label: p.label, blurb: p.blurb }))

  return <PassClient plans={plans} />
}
