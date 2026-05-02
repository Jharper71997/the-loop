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
  if (!phone && !email) return null

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
    const { data } = await supabase
      .from('contacts')
      .select('id, has_signed_waiver, waiver_version')
      .eq('email', email)
      .maybeSingle()
    existing = data
  }

  if (existing) {
    // Sparse-merge: only patch fields that have a real new value, so a sparse
    // payload (e.g. checkout that captured email but not phone, or a blank
    // first/last from a returning rider) can't blank existing data on file.
    const patch = { updated_at: new Date().toISOString() }
    if (info.firstName) patch.first_name = info.firstName
    if (info.lastName) patch.last_name = info.lastName
    if (email) patch.email = email
    if (phone) patch.phone = phone
    if (typeof info.smsConsent === 'boolean') patch.sms_consent = info.smsConsent

    const { error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', existing.id)
    if (error) throw new Error(`contact update: ${error.message}`)
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

export function normalizeEmail(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim().toLowerCase()
  return trimmed || null
}
