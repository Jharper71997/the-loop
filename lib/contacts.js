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

  const patch = {
    first_name: info.firstName || '',
    last_name: info.lastName || '',
    email: email,
    phone: phone,
    updated_at: new Date().toISOString(),
  }
  if (typeof info.smsConsent === 'boolean') patch.sms_consent = info.smsConsent

  if (existing) {
    const { error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', existing.id)
    if (error) throw new Error(`contact update: ${error.message}`)
    return { ...existing, ...patch, id: existing.id }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert(patch)
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
