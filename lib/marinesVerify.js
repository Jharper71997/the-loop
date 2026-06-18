import { normalizePhone } from './phone'
import { normalizeEmail } from './contacts'

// Read-side of the military verification gate.
//
// The verify queue (app/api/loop-admin/verifications) sets
// contacts.military_verified = true on approval. This looks a contact up by
// phone (preferred) then email and returns whether they are verified.
//
// It does NOT create a contact — it answers "is this person already cleared?"
// so the buy page can gate the Pay button and /api/checkout can hard-block a
// Marines purchase from an unverified rider. Returns false when no matching
// contact exists.
export async function isContactVerified(supabase, { phone, email } = {}) {
  const p = normalizePhone(phone)
  const e = normalizeEmail(email)
  if (!p && !e) return false

  let row = null
  if (p) {
    const { data } = await supabase
      .from('contacts')
      .select('military_verified')
      .eq('phone', p)
      .maybeSingle()
    row = data
  }
  if (!row && e) {
    const { data } = await supabase
      .from('contacts')
      .select('military_verified')
      .ilike('email', e)
      .maybeSingle()
    row = data
  }
  return !!row?.military_verified
}
