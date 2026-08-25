import { stripe } from './stripe'
import { supabaseAdmin } from './supabaseAdmin'

// Mirror Stripe subscription invoices into sponsor_payments + bar_payments.
//
// This logic already existed and worked. What it didn't have was a schedule:
// it ran only when someone pressed Sync Stripe on a leadership page, and the
// last time anyone did was June. Stripe kept billing bars and sponsors every
// month regardless, so by 2026-08-25 the newest sponsor_payments row was
// 2026-05-28 and the newest bar_payments row 2026-06-14, while ~$3,950 a month
// went on collecting — and every Money / Bars / Sponsors page read those tables
// and showed paid partners as unpaid.
//
// So it is a job now, and the button calls the same function.
//
// Idempotent by invoice id: the invoice's ID is the payment's `reference`, and
// an invoice already imported is skipped. Running it twice, or widening the
// window and running it again, cannot double-count.
//
// Match logic (unchanged):
//   0. stripe_partner_links.stripe_customer_id — the explicit link, added in
//      migration 049 because guessing at email matched 3 of 14 subscriptions.
//      Every Brew bar has a NULL contact_email, so the bar branch below could
//      never match anything, which is why bar_payments stopped at 8 rows.
//   1. Else Stripe customer.email against sponsors.contact (ILIKE) — sponsors
//      store emails inline, e.g. "Sway · 910-546-2975 · Dragons...@yahoo.com".
//   2. Else bars.contact_email, else bars.notes ILIKE email.
//
// An unmapped customer still falls through to the old behaviour, so adding
// links is purely additive.

const DEFAULT_DAYS = 120

// ILIKE treats % and _ as wildcards. An email containing either would quietly
// match the wrong partner, so neutralise them before interpolating.
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, m => `\\${m}`)
}

// .maybeSingle() throws when two rows match — and two sponsors sharing a
// contact string is a data problem, not a reason to abort the whole sync.
// Take the first match and carry on.
async function firstMatch(query) {
  const { data, error } = await query.limit(1)
  if (error) return { row: null, error }
  return { row: (data || [])[0] || null, error: null }
}

export async function syncStripePayments({ days = DEFAULT_DAYS, dryRun = false } = {}) {
  const s = stripe()
  const supabase = supabaseAdmin()

  const summary = {
    dryRun,
    days,
    invoices_seen: 0,
    sponsor_payments_inserted: 0,
    bar_payments_inserted: 0,
    matched_by_link: 0,
    skipped_already_imported: 0,
    skipped_out_of_window: 0,
    skipped_no_match: [],
    would_insert: [],
    errors: [],
  }

  // Every active subscription, paginated.
  const subs = []
  let starting_after
  for (;;) {
    const page = await s.subscriptions.list({
      status: 'active',
      limit: 100,
      starting_after,
      expand: ['data.customer'],
    })
    subs.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length - 1]?.id
    if (!starting_after) break
  }
  summary.active_subscriptions = subs.length

  const cutoff = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  for (const sub of subs) {
    const customer = sub.customer
    const customerId = typeof customer === 'object' ? customer.id : customer
    const email = (typeof customer === 'object' ? customer.email : null)?.toLowerCase()
    if (!email) {
      summary.skipped_no_match.push(`subscription ${sub.id} has no customer email`)
      continue
    }

    // The explicit link wins over any amount of email cleverness.
    let sponsor = null
    let bar = null
    let matchedBy = 'link'

    const { data: link } = await supabase
      .from('stripe_partner_links')
      .select('partner_type, bar_slug, sponsor_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (link?.partner_type === 'sponsor' && link.sponsor_id) {
      const { row } = await firstMatch(
        supabase.from('sponsors').select('id, name').eq('id', link.sponsor_id)
      )
      sponsor = row
    } else if (link?.partner_type === 'bar' && link.bar_slug) {
      const { row } = await firstMatch(
        supabase.from('bars').select('slug, name').eq('slug', link.bar_slug)
      )
      bar = row
    }

    const safe = escapeLike(email)
    if (!sponsor && !bar) {
      matchedBy = 'email'
      const { row } = await firstMatch(
        supabase.from('sponsors').select('id, name').ilike('contact', `%${safe}%`)
      )
      sponsor = row
    }

    if (!sponsor && !bar) {
      const { row: byEmail } = await firstMatch(
        supabase.from('bars').select('slug, name').ilike('contact_email', safe)
      )
      if (byEmail) {
        bar = byEmail
      } else {
        const { row: byNotes } = await firstMatch(
          supabase.from('bars').select('slug, name').ilike('notes', `%${safe}%`)
        )
        if (byNotes) bar = byNotes
      }
    }

    if (!sponsor && !bar) {
      // Name the customer id, not just the email — it is what you paste into
      // stripe_partner_links to fix this permanently.
      summary.skipped_no_match.push(`${email} (Stripe customer ${customerId || 'unknown'})`)
      continue
    }
    if (matchedBy === 'link') summary.matched_by_link += 1

    const invoices = await s.invoices.list({ customer: customerId, status: 'paid', limit: 24 })

    for (const inv of invoices.data) {
      summary.invoices_seen += 1
      if (inv.created < cutoff) {
        summary.skipped_out_of_window += 1
        continue
      }

      const amountCents = inv.amount_paid || inv.total || 0
      const paidAtSec = inv.status_transitions?.paid_at || inv.created
      const paidAt = new Date(paidAtSec * 1000).toISOString()
      const periodStartSec = inv.lines?.data?.[0]?.period?.start || paidAtSec
      const periodDate = new Date(periodStartSec * 1000)
      const periodKey = `${periodDate.getUTCFullYear()}-${String(periodDate.getUTCMonth() + 1).padStart(2, '0')}-01`

      const target = sponsor
        ? { table: 'sponsor_payments', keyCol: 'sponsor_id', keyVal: sponsor.id, label: sponsor.name }
        : { table: 'bar_payments', keyCol: 'bar_slug', keyVal: bar.slug, label: bar.name }

      const { data: existing } = await supabase
        .from(target.table).select('id')
        .eq(target.keyCol, target.keyVal).eq('reference', inv.id)
        .maybeSingle()
      if (existing) {
        summary.skipped_already_imported += 1
        continue
      }

      const row = {
        [target.keyCol]: target.keyVal,
        amount_cents: amountCents,
        paid_for_period: periodKey,
        paid_at: paidAt,
        method: 'stripe',
        reference: inv.id,
        notes: `Stripe invoice ${inv.number || inv.id} · auto-synced`,
      }

      if (dryRun) {
        summary.would_insert.push({
          table: target.table,
          who: target.label,
          amount: `$${(amountCents / 100).toFixed(2)}`,
          paid_at: paidAt.slice(0, 10),
          period: periodKey,
          invoice: inv.number || inv.id,
        })
        continue
      }

      const { error } = await supabase.from(target.table).insert(row)
      if (error) {
        summary.errors.push(`${target.table} insert (${target.label}): ${error.message}`)
      } else if (sponsor) {
        summary.sponsor_payments_inserted += 1
      } else {
        summary.bar_payments_inserted += 1
      }
    }
  }

  return summary
}
