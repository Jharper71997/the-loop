import { supabaseAdmin } from './supabaseAdmin'
import { sendSms } from './sms'
import { appUrl } from './stripe'

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

// Sends a waiver-signing SMS to a single contact if they haven't signed and
// haven't been texted in the last 24h. Returns one of:
//   { sent: true }
//   { skipped: 'no_phone' | 'already_signed' | 'deduped' | 'no_waiver' }
export async function textUnsignedContact(supabase, contact, { force = false } = {}) {
  const sb = supabase || supabaseAdmin()
  if (!contact?.phone) return { skipped: 'no_phone' }
  if (contact.has_signed_waiver) return { skipped: 'already_signed' }

  if (!force && contact.waiver_sms_sent_at) {
    const last = new Date(contact.waiver_sms_sent_at).getTime()
    if (Date.now() - last < 24 * 60 * 60 * 1000) return { skipped: 'deduped' }
  }

  const current = await getCurrentWaiverVersion(sb)
  if (!current) return { skipped: 'no_waiver' }

  const firstName = contact.first_name ? ` ${contact.first_name}` : ''
  const link = `${appUrl()}/waiver/${contact.id}`
  const body = `Brew Loop${firstName}: sign your liability waiver before pickup. Takes 30 seconds: ${link}`

  await sendSms(contact.phone, body)
  await sb
    .from('contacts')
    .update({
      waiver_sms_sent_at: new Date().toISOString(),
      waiver_sms_count: (contact.waiver_sms_count || 0) + 1,
    })
    .eq('id', contact.id)

  return { sent: true }
}

// Texts every unsigned rider on a Loop. Returns per-contact results.
export async function textUnsignedForGroup(supabase, groupId, { force = false } = {}) {
  const sb = supabase || supabaseAdmin()
  const { data: members, error } = await sb
    .from('group_members')
    .select(`
      id,
      contacts ( id, first_name, last_name, phone, has_signed_waiver, waiver_sms_sent_at, waiver_sms_count )
    `)
    .eq('group_id', groupId)
  if (error) throw new Error(`group_members read: ${error.message}`)

  const results = []
  for (const m of members || []) {
    const c = m.contacts
    if (!c) continue
    try {
      const r = await textUnsignedContact(sb, c, { force })
      results.push({ contactId: c.id, ...r })
    } catch (err) {
      results.push({ contactId: c.id, error: err.message })
    }
  }
  return results
}
