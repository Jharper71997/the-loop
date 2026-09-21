import { normalizePhone } from './phone'

// Find or create a contact, deduped by phone (preferred) then email.
// Returns the contact row { id, ...patches applied }.
//
//   info: { firstName, lastName, email, phone, smsConsent? }
//
// Mirrors the dedupe logic in lib/ticketTailor.js so both the legacy TT
// webhook and the native checkout reach the same row for the same rider.
export async function upsertContactByPhoneOrEmail(supabase, info) {
  const phone = normalizePhone(info.phone)
  const email = normalizeEmail(info.email)
  // Phone-required: a contact without a phone can't be SMS'd or texted a
  // check-in QR. Skip the row entirely so the contacts table doesn't fill
  // up with phantom phoneless entries.
  if (!phone) return null

  let existing = null
  if (phone) {
    const { data } = await supabase
      .from('contacts')
      .select('id, has_signed_waiver, waiver_version')
      .eq('phone', phone)
      .maybeSingle()
    existing = data
  }
  if (!existing && email) {
    // ilike for case-insensitive match — see lib/ticketTailor.js for context.
    const { data } = await supabase
      .from('contacts')
      .select('id, has_signed_waiver, waiver_version')
      .ilike('email', email)
      .maybeSingle()
    existing = data
  }

  if (existing) {
    // Sparse-merge: only patch fields that have a real new value, so a sparse
    // payload (e.g. checkout that captured email but not phone, or a blank
    // first/last from a returning rider) can't blank existing data on file.
    const patch = { updated_at: new Date().toISOString() }
    // identityIsTrusted=false means the caller hasn't proved they are this
    // person — an unauthenticated endpoint that matched an existing row purely
    // on a phone number. Those callers may not rewrite the row's name or
    // email: doing so redirected the rider's future booking confirmations
    // (which prefer contacts.email) to whatever address the caller supplied.
    // They also may not flip consent back on for someone who opted out.
    const trusted = info.identityIsTrusted !== false
    if (trusted) {
      if (info.firstName) patch.first_name = info.firstName
      if (info.lastName) patch.last_name = info.lastName
      if (email) patch.email = email
      if (typeof info.smsConsent === 'boolean') patch.sms_consent = info.smsConsent
    } else if (typeof info.smsConsent === 'boolean' && info.smsConsent === false) {
      // An untrusted caller can always withdraw consent, never grant it.
      patch.sms_consent = false
    }
    if (phone) patch.phone = phone

    const { error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', existing.id)
    if (error) {
      // A returning buyer can have their phone on one contact row and this
      // email already on a DIFFERENT row (e.g. they booked once with a work
      // email + phone, later with a personal email + the same phone). Moving
      // the email onto the phone-matched row trips the contacts_email_key
      // unique constraint (SQLSTATE 23505) and, uncaught, 500s the whole
      // checkout. Don't lose the sale over a duplicate email: keep this row's
      // existing email and re-apply the rest. The two split records can be
      // reconciled out-of-band.
      const emailCollision =
        patch.email &&
        error.code === '23505' &&
        /email/i.test(`${error.message} ${error.details || ''}`)
      if (!emailCollision) throw new Error(`contact update: ${error.message}`)
      delete patch.email
      const { error: retryErr } = await supabase
        .from('contacts')
        .update(patch)
        .eq('id', existing.id)
      if (retryErr) throw new Error(`contact update: ${retryErr.message}`)
    }
    return { ...existing, ...patch, id: existing.id }
  }

  const insertRow = {
    first_name: info.firstName || '',
    last_name: info.lastName || '',
    email,
    phone,
    updated_at: new Date().toISOString(),
  }
  if (typeof info.smsConsent === 'boolean') insertRow.sms_consent = info.smsConsent

  const { data, error } = await supabase
    .from('contacts')
    .insert(insertRow)
    .select('id, has_signed_waiver, waiver_version')
    .single()
  if (error) throw new Error(`contact insert: ${error.message}`)
  return data
}

// Callers treat a non-null return as "this is a well-formed email" — several
// say so in comments — so it has to actually be one. It previously returned any
// non-empty string, which let a comma-bearing value be interpolated into a
// PostgREST .or() filter on a public service-role route and OR in an extra
// condition. The character class also excludes the PostgREST filter
// metacharacters (comma, parens, quotes, dot-separators are fine inside the
// local part but a bare comma is not) and the LIKE wildcards.
const EMAIL_RE = /^[^\s@,()."'%]+@[^\s@,()."'%]+\.[^\s@,()."'%]{2,}$/

export function normalizeEmail(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim().toLowerCase()
  if (!trimmed) return null
  return EMAIL_RE.test(trimmed) ? trimmed : null
}
