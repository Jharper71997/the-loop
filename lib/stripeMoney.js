import { stripe } from './stripe'

// Money that actually arrived, asked of Stripe rather than inferred from our
// own tables.
//
// The leadership page used to total the `orders` table and call it revenue.
// Orders only ever hold ticket sales, so the number left out every bar and
// sponsor subscription — which is most of the money. Over the 45 days to
// 2026-08-25: $5,150 of subscriptions against $1,248 of ticket checkouts, and
// the subscription half appeared nowhere on the page.
//
// Worse, the two tables that should hold it had quietly stopped being written:
// the newest sponsor_payments row was 2026-05-28 and the newest bar_payments
// row 2026-06-14, while Stripe kept charging those same customers every month.
// Reading Stripe directly means the headline number cannot drift again just
// because a sync job stopped.
//
// What this deliberately does NOT include: Ticket Tailor. TT collects and pays
// out on its own account, so its sales are real money that never touches this
// Stripe account. Rider counts come from the database for exactly that reason —
// see the riders cards, which count people, not dollars.

const CHARGE_CAP = 600      // far beyond a Brew Loop month; stops a runaway page walk
const TTL_MS = 5 * 60 * 1000

let cache = { key: null, at: 0, value: null }

function isSubscription(charge) {
  return /subscription/i.test(charge.description || '')
}

export async function getStripeMoneyIn({ days = 30 } = {}) {
  const key = `d${days}`
  if (cache.key === key && Date.now() - cache.at < TTL_MS) return cache.value

  const since = Math.floor(Date.now() / 1000) - days * 86400

  let value
  try {
    const charges = []
    for await (const c of stripe().charges.list({ created: { gte: since }, limit: 100 })) {
      charges.push(c)
      if (charges.length >= CHARGE_CAP) break
    }

    const paid = charges.filter(c => c.paid && c.status === 'succeeded')
    const net = c => (c.amount || 0) - (c.amount_refunded || 0)

    const subsCents = paid.filter(isSubscription).reduce((s, c) => s + net(c), 0)
    const ticketsCents = paid.filter(c => !isSubscription(c)).reduce((s, c) => s + net(c), 0)

    value = {
      ok: true,
      days,
      grossCents: subsCents + ticketsCents,
      subsCents,
      ticketsCents,
      count: paid.length,
      // A page that can't reach Stripe must say so rather than print a zero
      // that looks like a bad month.
      error: null,
    }
  } catch (e) {
    value = { ok: false, days, grossCents: null, subsCents: null, ticketsCents: null, count: 0, error: e.message }
  }

  cache = { key, at: Date.now(), value }
  return value
}

// Is anything still writing the payment tables the Money pages read? Both
// stopped in mid-2026 while Stripe carried on billing, so the Money pages show
// a bar as unpaid months after it paid.
export async function getPaymentSyncHealth(sb) {
  const [sponsor, bar] = await Promise.all([
    sb.from('sponsor_payments').select('paid_at').order('paid_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('bar_payments').select('paid_at').order('paid_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const age = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null)
  const sponsorAt = sponsor?.data?.paid_at ?? null
  const barAt = bar?.data?.paid_at ?? null

  return {
    sponsorAt,
    barAt,
    sponsorAgeDays: age(sponsorAt),
    barAgeDays: age(barAt),
    // Subscriptions bill monthly, so 45 days of silence means it is broken and
    // not merely quiet.
    stale: (age(sponsorAt) ?? 999) > 45 || (age(barAt) ?? 999) > 45,
  }
}
