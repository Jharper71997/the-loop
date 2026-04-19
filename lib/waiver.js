import { supabaseAdmin } from './supabaseAdmin'

// Loads the highest-version waiver. Single source of truth for "what does the
// rider need to sign right now".
export async function getCurrentWaiverVersion(supabase) {
  const sb = supabase || supabaseAdmin()
  const { data, error } = await sb
    .from('waiver_versions')
    .select('id, version, body_md, effective_at')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`waiver_versions read: ${error.message}`)
  return data
}

// Returns true if the contact has a signature for the current waiver version.
export async function contactHasSignedCurrent(supabase, contactId) {
  if (!contactId) return false
  const sb = supabase || supabaseAdmin()
  const current = await getCurrentWaiverVersion(sb)
  if (!current) return false
  const { data } = await sb
    .from('waiver_signatures')
    .select('id')
    .eq('contact_id', contactId)
    .eq('waiver_version_id', current.id)
    .maybeSingle()
  return !!data
}

// Persist a signature. Idempotent: re-signing the same version is a no-op
// thanks to the unique(contact_id, waiver_version_id) constraint.
//   sig: { contactId, fullNameTyped, ipAddress, userAgent, signedForContactId, orderId }
export async function recordSignature(supabase, sig) {
  const sb = supabase || supabaseAdmin()
  const current = await getCurrentWaiverVersion(sb)
  if (!current) throw new Error('no waiver version configured')

  const row = {
    contact_id: sig.contactId,
    waiver_version_id: current.id,
    full_name_typed: sig.fullNameTyped,
    ip_address: sig.ipAddress || null,
    user_agent: sig.userAgent || null,
    signed_for_contact_id: sig.signedForContactId || null,
    order_id: sig.orderId || null,
  }

  const { error } = await sb
    .from('waiver_signatures')
    .upsert(row, { onConflict: 'contact_id,waiver_version_id' })
  if (error) throw new Error(`waiver_signatures insert: ${error.message}`)

  await sb
    .from('contacts')
    .update({
      has_signed_waiver: true,
      waiver_signed_at: new Date().toISOString(),
      waiver_version: current.version,
    })
    .eq('id', sig.contactId)

  return current
}
