import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { createPassCheckoutSession } from '@/lib/stripe'
import { PASS_PLANS } from '@/lib/loopPass'
import { recordAlert } from '@/lib/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/loop-pass
// Body: { first_name, last_name, phone, email, plan }
// Returns: { url }  — the Stripe Checkout URL to start the subscription.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const firstName = String(body?.first_name || '').trim()
  const lastName = String(body?.last_name || '').trim()
  const email = normalizeEmail(body?.email)
  const phone = normalizePhone(body?.phone)
  const plan = String(body?.plan || 'monthly').trim()

  if (!firstName) return bad('first_name required')
  if (!phone) return bad('A mobile number is required so we can text your pickup details.')

  const planDef = PASS_PLANS[plan]
  if (!planDef) return bad('unknown plan')

  const priceId = process.env[planDef.envKey]
  if (!priceId) {
    return Response.json(
      { error: 'The Loop Pass isn’t live yet — text us at (636) 266-1801 and we’ll set you up.' },
      { status: 503 },
    )
  }

  const supabase = supabaseAdmin()

  // Upsert the rider so the pass (and its future bookings) tie to one contact.
  let contact = null
  try {
    contact = await upsertContactByPhoneOrEmail(supabase, {
      firstName,
      lastName,
      email,
      phone,
    })
  } catch (err) {
    console.error('[loop-pass] contact upsert failed', err)
  }
  if (!contact?.id) return bad('Could not save your details. Please check your phone number.')

  const origin = req.headers.get('origin') || undefined

  try {
    const session = await createPassCheckoutSession({
      contactId: contact.id,
      email,
      phone,
      plan,
      priceId,
      origin,
    })
    return Response.json({ url: session.url })
  } catch (err) {
    console.error('[loop-pass] checkout session failed', err)
    await recordAlert(supabase, {
      kind: 'finalize_failed',
      subject: 'Loop Pass checkout session failed',
      body: err?.message || String(err),
      context: { contact_id: contact.id, plan },
    })
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 })
}
