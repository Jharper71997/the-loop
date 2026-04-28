import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { recordSignature, getCurrentWaiverVersion } from '@/lib/waiver'
import { finalizeBooking } from '@/lib/booking'
import { appUrl } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/claim/[token]
//   body: { first_name, last_name, phone, email, sms_consent, typed_name }
// Friend opens a claim link from a buyer's confirmation, fills info + signs
// the waiver. Race-protected — first request wins, second sees already_claimed.
export async function POST(req, ctx) {
  const { token } = await ctx.params
  if (!token) return Response.json({ error: 'missing_token' }, { status: 400 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'bad_json' }, { status: 400 }) }

  const first = String(body?.first_name || '').trim()
  const last = String(body?.last_name || '').trim()
  const phone = body?.phone || null
  const email = body?.email || null
  const typedName = String(body?.typed_name || '').trim()
  const smsConsent = !!body?.sms_consent

  if (!first || !last) return Response.json({ error: 'name_required' }, { status: 400 })
  if (!phone && !email) return Response.json({ error: 'phone_or_email_required' }, { status: 400 })
  if (!typedName) return Response.json({ error: 'typed_name_required' }, { status: 400 })

  const sb = supabaseAdmin()

  // Race-protected lookup: an UPDATE with WHERE claimed_at IS NULL ensures
  // only the first request flips the row.
  const { data: item } = await sb
    .from('order_items')
    .select('id, order_id, ticket_type_id, claim_token, claimed_at, voided_at, contact_id')
    .eq('claim_token', token)
    .maybeSingle()

  if (!item || item.voided_at) return Response.json({ error: 'invalid_token' }, { status: 404 })
  if (item.claimed_at) return Response.json({ error: 'already_claimed' }, { status: 409 })

  // Look up the friend's contact row (creates if missing).
  const contact = await upsertContactByPhoneOrEmail(sb, {
    firstName: first,
    lastName: last,
    email,
    phone,
    smsConsent,
  })
  if (!contact) return Response.json({ error: 'contact_failed' }, { status: 500 })

  // Atomic claim: only succeeds if no one else has claimed this row yet.
  const { data: claimed, error: claimErr } = await sb
    .from('order_items')
    .update({
      contact_id: contact.id,
      claimed_at: new Date().toISOString(),
      rider_first_name: first,
      rider_last_name: last,
      rider_email: normalizeEmail(email),
      rider_phone: normalizePhone(phone),
    })
    .eq('id', item.id)
    .is('claimed_at', null)
    .select('id, order_id')
    .maybeSingle()
  if (claimErr || !claimed) {
    return Response.json({ error: 'already_claimed' }, { status: 409 })
  }

  // Sign the waiver if not already on file. Re-pull current version so it
  // matches whatever was active when the friend opens the link (could be
  // newer than what the buyer saw at checkout).
  const waiver = await getCurrentWaiverVersion(sb)
  if (waiver) {
    try {
      await recordSignature(sb, {
        contactId: contact.id,
        fullNameTyped: typedName,
        signedForContactId: null,
        orderId: item.order_id,
      })
    } catch (err) {
      console.error('[claim] waiver signature failed', err)
    }
  }

  // Pull friend onto the dispatch group_members board.
  const { data: order } = await sb
    .from('orders')
    .select('event_id')
    .eq('id', item.order_id)
    .maybeSingle()
  if (order?.event_id) {
    const { data: ev } = await sb
      .from('events')
      .select('group_id')
      .eq('id', order.event_id)
      .maybeSingle()
    if (ev?.group_id) {
      await sb
        .from('group_members')
        .upsert([{ group_id: ev.group_id, contact_id: contact.id }], {
          onConflict: 'group_id,contact_id',
          ignoreDuplicates: true,
        })
    }
  }

  // Re-finalize the booking so QRs are minted and the friend gets their
  // own SMS + email confirmation. force=false because this is the first
  // delivery to this contact, so the dedup window won't fire.
  let ticketUrl = null
  try {
    const result = await finalizeBooking(sb, item.order_id, { force: true })
    const link = (result?.rider_email || []).find(r => r.contact === contact.id)
    // Find the QR code minted for this item to redirect the friend to /tickets/<code>
    const { data: qr } = await sb
      .from('qr_codes')
      .select('code')
      .eq('order_item_id', item.id)
      .eq('kind', 'checkin')
      .maybeSingle()
    if (qr?.code) ticketUrl = `${appUrl()}/tickets/${qr.code}`
  } catch (err) {
    console.error('[claim] finalizeBooking failed', err)
  }

  return Response.json({ ok: true, ticket_url: ticketUrl })
}
