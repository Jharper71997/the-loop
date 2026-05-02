import { NextResponse } from 'next/server'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Pull Stripe subscription invoice payments and mirror them into
// sponsor_payments + bar_payments. Idempotent: each invoice's ID becomes
// the payment's `reference` field; we skip invoices we've already imported.
//
// Match logic:
//   1. Stripe customer.email is checked against sponsors.contact (ILIKE) first.
//      Sponsors store emails inline in the contact field (e.g.,
//      "Sway · 910-546-2975 · DragonsBreath258@yahoo.com").
//   2. If no sponsor match, check bars.contact_email = email exactly, or
//      bars.notes ILIKE email (catches Twin Ravens whose Stripe customer
//      email is johnhenryinvestmentsllc2025@gmail.com but bar contact may
//      not have that).

export async function POST() {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const s = stripe()
  const supabase = supabaseAdmin()

  const summary = {
    invoices_seen: 0,
    sponsor_payments_inserted: 0,
    bar_payments_inserted: 0,
    skipped_already_imported: 0,
    skipped_no_match: [],
    errors: [],
  }

  // Pull all active subscriptions (paginated up to 100 per page).
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

  // For each subscription, list paid invoices in the last 90 days.
  const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)

  for (const sub of subs) {
    const customer = sub.customer
    const email = (typeof customer === 'object' ? customer.email : null)?.toLowerCase()
    if (!email) {
      summary.skipped_no_match.push(`subscription ${sub.id} has no customer email`)
      continue
    }

    // Find matching sponsor or bar.
    const { data: sponsor } = await supabase
      .from('sponsors')
      .select('id, name')
      .ilike('contact', `%${email}%`)
      .maybeSingle()

    let bar = null
    if (!sponsor) {
      const { data: barByEmail } = await supabase
        .from('bars')
        .select('slug, name')
        .ilike('contact_email', email)
        .maybeSingle()
      if (barByEmail) {
        bar = barByEmail
      } else {
        const { data: barByNotes } = await supabase
          .from('bars')
          .select('slug, name')
          .ilike('notes', `%${email}%`)
          .maybeSingle()
        if (barByNotes) bar = barByNotes
      }
    }

    if (!sponsor && !bar) {
      summary.skipped_no_match.push(`${email} (Stripe customer ${customer.id || 'unknown'})`)
      continue
    }

    // Pull paid invoices for this customer.
    const invoices = await s.invoices.list({
      customer: typeof customer === 'object' ? customer.id : customer,
      status: 'paid',
      limit: 24,
    })

    for (const inv of invoices.data) {
      summary.invoices_seen += 1
      if (inv.created < ninetyDaysAgo) continue

      const amountCents = inv.amount_paid || inv.total || 0
      const paidAtSec = inv.status_transitions?.paid_at || inv.created
      const paidAt = new Date(paidAtSec * 1000).toISOString()
      const periodStartSec = inv.lines?.data?.[0]?.period?.start || paidAtSec
      const periodDate = new Date(periodStartSec * 1000)
      const periodKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}-01`

      if (sponsor) {
        const { data: existing } = await supabase
          .from('sponsor_payments')
          .select('id')
          .eq('sponsor_id', sponsor.id)
          .eq('reference', inv.id)
          .maybeSingle()
        if (existing) {
          summary.skipped_already_imported += 1
          continue
        }
        const { error } = await supabase.from('sponsor_payments').insert({
          sponsor_id: sponsor.id,
          amount_cents: amountCents,
          paid_for_period: periodKey,
          paid_at: paidAt,
          method: 'stripe',
          reference: inv.id,
          notes: `Stripe invoice ${inv.number || inv.id} · auto-synced`,
        })
        if (error) {
          summary.errors.push(`sponsor_payments insert: ${error.message}`)
        } else {
          summary.sponsor_payments_inserted += 1
        }
      } else if (bar) {
        const { data: existing } = await supabase
          .from('bar_payments')
          .select('id')
          .eq('bar_slug', bar.slug)
          .eq('reference', inv.id)
          .maybeSingle()
        if (existing) {
          summary.skipped_already_imported += 1
          continue
        }
        const { error } = await supabase.from('bar_payments').insert({
          bar_slug: bar.slug,
          amount_cents: amountCents,
          paid_for_period: periodKey,
          paid_at: paidAt,
          method: 'stripe',
          reference: inv.id,
          notes: `Stripe invoice ${inv.number || inv.id} · auto-synced`,
        })
        if (error) {
          summary.errors.push(`bar_payments insert: ${error.message}`)
        } else {
          summary.bar_payments_inserted += 1
        }
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
