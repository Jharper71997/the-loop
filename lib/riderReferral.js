// Rider referral codes — the per-contact code behind /invite/<code>.
//
// Leaderboard-only: a referral earns standing on the rider leaderboard, never a
// discount or payout (consistent with the Brew Loop no-discount stance).

import { randomBytes } from 'crypto'

// Short, URL-safe, unambiguous (no 0/O/1/I/L). Uppercase so /invite is
// case-insensitive in practice (we uppercase on the way in).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function genCode(len = 7) {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

// Return the contact's referral code, generating + persisting one on first use.
// The `.is('referral_code', null)` guard makes concurrent calls converge on a
// single code instead of clobbering each other.
export async function getOrCreateReferralCode(supabase, contactId) {
  if (!contactId) return null
  const { data: c } = await supabase
    .from('contacts')
    .select('id, referral_code')
    .eq('id', contactId)
    .maybeSingle()
  if (!c) return null
  if (c.referral_code) return c.referral_code

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode()
    const { error } = await supabase
      .from('contacts')
      .update({ referral_code: code })
      .eq('id', contactId)
      .is('referral_code', null)
    // Whether we won the race or a collision/concurrent write occurred, re-read
    // and return whatever code is now on the row.
    const { data: after } = await supabase
      .from('contacts')
      .select('referral_code')
      .eq('id', contactId)
      .maybeSingle()
    if (after?.referral_code) return after.referral_code
    if (error) continue
  }
  return null
}
