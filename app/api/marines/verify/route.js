import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/marines/verify
// Rider submits a military verification request. Phase 1 = manual review: we
// create the contact + a pending military_verifications row. Approval (which
// flips contacts.military_verified) happens in the ops dashboard (Phase 2),
// or is replaced by an automated provider (SheerID / ID.me) once chosen.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }

  const { first_name, last_name, email, phone, branch, rank, unit, note } = body || {}
  if (!first_name || (!email && !phone)) {
    return Response.json({ error: 'Add your name and at least an email or phone.' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  const contact = await upsertContactByPhoneOrEmail(supabase, {
    firstName: first_name,
    lastName: last_name,
    email,
    phone,
    smsConsent: true,
  })
  if (!contact) return Response.json({ error: 'Add a valid email or phone.' }, { status: 400 })

  // Don't stack duplicate pending requests for the same person.
  const { data: existing } = await supabase
    .from('military_verifications')
    .select('id')
    .eq('contact_id', contact.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) return Response.json({ ok: true, status: 'pending', deduped: true })

  const { error } = await supabase.from('military_verifications').insert({
    contact_id: contact.id,
    full_name: `${first_name || ''} ${last_name || ''}`.trim(),
    email: normalizeEmail(email) || null,
    phone: normalizePhone(phone) || null,
    branch: branch || null,
    rank: rank || null,
    unit: unit || null,
    method: 'manual',
    status: 'pending',
    note: note || null,
  })
  if (error) {
    console.error('[marines/verify] insert failed', error)
    return Response.json({ error: 'Could not save your request. Try again.' }, { status: 500 })
  }

  return Response.json({ ok: true, status: 'pending' })
}
