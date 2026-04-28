import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { refundOrder } from '@/lib/stripe'
import { recordAlert } from '@/lib/alerts'
import { sendSms } from '@/lib/sms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/order-items/[id]/void
//   body: { reason?, refund?: boolean }
// Voids a single order_item (frees the seat for capacity counting). If every
// item on the parent order is now voided, flips the order to status='voided'.
// Optionally issues a Stripe refund for the proportional amount.
//
// Leadership-only — direct access to ticket data.
export async function POST(req, ctx) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const { id } = await ctx.params
  if (!id) return Response.json({ error: 'missing_id' }, { status: 400 })

  let body = {}
  try { body = await req.json() } catch {}
  const reason = (body?.reason || '').trim() || null
  const wantRefund = !!body?.refund

  const sb = supabaseAdmin()

  // Pull the item + parent order so we know what to free up.
  const { data: item, error: itemErr } = await sb
    .from('order_items')
    .select(`
      id, order_id, contact_id, voided_at, unit_price_cents,
      order:orders ( id, event_id, stripe_payment_intent_id, total_cents, status, buyer_phone )
    `)
    .eq('id', id)
    .maybeSingle()
  if (itemErr || !item) return Response.json({ error: 'not_found' }, { status: 404 })
  if (item.voided_at) return Response.json({ error: 'already_voided' }, { status: 409 })

  // Identify who voided it for the audit trail.
  const userEmail = await currentUserEmail()

  // Mark voided.
  await sb
    .from('order_items')
    .update({
      voided_at: new Date().toISOString(),
      voided_by: userEmail || 'admin',
      void_reason: reason,
    })
    .eq('id', id)

  // Re-derive party_size from active order_items so existing rollups (Loops
  // index, Tonight count, contact tickets) reflect the void without having
  // to be rewritten. Re-counting avoids drift if multiple voids race.
  const { count: stillActive } = await sb
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', item.order_id)
    .is('voided_at', null)
  await sb
    .from('orders')
    .update({ party_size: stillActive || 0 })
    .eq('id', item.order_id)

  // Free the corresponding group_members row so the rider drops off the
  // dispatch board. group_members is recreatable from order_items if needed.
  if (item.order?.event_id && item.contact_id) {
    const { data: ev } = await sb
      .from('events')
      .select('group_id')
      .eq('id', item.order.event_id)
      .maybeSingle()
    if (ev?.group_id) {
      await sb
        .from('group_members')
        .delete()
        .eq('group_id', ev.group_id)
        .eq('contact_id', item.contact_id)
    }
  }

  // If every item on this order is now voided, flip the order to voided.
  let orderVoided = false
  if ((stillActive || 0) === 0) {
    await sb
      .from('orders')
      .update({ status: 'voided', refunded_at: new Date().toISOString() })
      .eq('id', item.order_id)
    orderVoided = true
  }

  // Optional Stripe refund for this seat's portion of the charge.
  let refundResult = null
  if (wantRefund && item.order?.stripe_payment_intent_id) {
    try {
      // Refund just this item's price in cents — partial refund is supported.
      const cents = item.unit_price_cents || 0
      if (cents > 0) {
        refundResult = await refundOrder(item.order.stripe_payment_intent_id, { amount_cents: cents })
      }
    } catch (err) {
      await recordAlert(sb, {
        kind: 'finalize_failed',
        subject: `Stripe refund failed during void (item ${id.slice(0, 8)})`,
        body: err?.message || String(err),
        context: { order_item_id: id, order_id: item.order_id },
      })
      refundResult = { error: err?.message || String(err) }
    }
  }

  // Apology SMS to buyer when whole order is voided + refund issued.
  if (orderVoided && wantRefund && item.order?.buyer_phone) {
    try {
      await sendSms(
        item.order.buyer_phone,
        `Brew Loop: your booking has been refunded. ${reason ? `Reason: ${reason}. ` : ''}Hope to see you on a future Loop.`
      )
    } catch (err) {
      console.error('[void] apology SMS failed', err)
    }
  }

  return Response.json({
    ok: true,
    voided_id: id,
    order_voided: orderVoided,
    refund: refundResult,
  })
}

async function currentUserEmail() {
  // routeAuth already verified leadership; we just want the email for the
  // audit trail. Quietly tolerate failure — the void still proceeds.
  try {
    const { cookies } = await import('next/headers')
    const { createServerClient } = await import('@supabase/ssr')
    const cookieStore = await cookies()
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data } = await sb.auth.getUser()
    return data?.user?.email || null
  } catch {
    return null
  }
}
