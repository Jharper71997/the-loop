import { normalizePhone } from './phone'

// Storage for the two-way SimpleTexting log (sql/056_sms_messages.sql).
//
// Every writer (sendSms, the webhook, the sync cron) funnels through here so
// there is exactly one set of rules for:
//   * idempotency: provider_message_id is unique; a message seen twice (our
//     own send, then the OUTGOING_MESSAGE webhook, then the poll) is one row;
//   * status never going backwards: a delivery report that lands before the
//     poll or before our own insert is kept, and a later "sent" never
//     overwrites "delivered" / "undelivered";
//   * opt-outs: a STOP flips contacts.sms_consent to false and records the
//     number in sms_opt_outs. A re-subscribe clears sms_opt_outs only. It
//     never grants consent; that only comes from the rider ticking the box.
//
// Everything here takes a service-role client. None of it sends a text.

export const SMS_PROVIDER = 'simpletexting'

// SimpleTexting speaks 10-digit US numbers ("9104127026"); the app stores
// E.164 ("+19104127026"). normalizePhone handles both.
export function toE164(raw) {
  return normalizePhone(raw)
}

// Most recently touched contact with this phone, or null. Several contacts can
// share a number (a buyer re-entered under a new email), so pick the freshest.
export async function findContactIdByPhone(sb, e164) {
  if (!e164) return null
  const { data } = await sb
    .from('contacts')
    .select('id')
    .eq('phone', e164)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
  return data?.[0]?.id || null
}

// Keep only what the inbox needs to explain a row later. SimpleTexting
// payloads carry no secrets, but there is no reason to keep more than this.
function trimRaw(obj) {
  if (!obj || typeof obj !== 'object') return null
  const keep = ['id', 'messageId', 'directionType', 'category', 'referenceType',
    'timestamp', 'accountPhone', 'contactPhone', 'carrier', 'subject', 'type', 'reportId', 'webhookId']
  const out = {}
  for (const k of keep) if (obj[k] != null) out[k] = obj[k]
  return out
}

function validTs(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Upsert one provider message (inbound or outbound) as seen by the poll or a
// message webhook. `msg` uses SimpleTexting field names:
//   { id | messageId, text, subject, contactPhone, accountPhone, directionType
//     ('MO' in, 'MT' out), timestamp, category, referenceType, mediaItems }
// opts.direction overrides directionType (webhooks know it from the trigger).
// opts.markReadBefore: ISO date; inbound messages older than this are stored
// already read, so a first backfill does not light up months of old replies.
export async function upsertProviderMessage(sb, msg, opts = {}) {
  const providerId = msg?.id || msg?.messageId
  if (!providerId) return { skipped: 'no_id' }
  const phone = toE164(msg.contactPhone)
  if (!phone) return { skipped: 'bad_phone' }

  const direction = opts.direction || (msg.directionType === 'MO' ? 'in' : 'out')
  const providerTs = validTs(msg.timestamp) || new Date().toISOString()
  const media = Array.isArray(msg.mediaItems) && msg.mediaItems.length ? msg.mediaItems : null
  const body = msg.text ?? (msg.subject || null)

  const { data: existing, error: selErr } = await sb
    .from('sms_messages')
    .select('id, body, contact_id, status, media, category, reference_type')
    .eq('provider_message_id', providerId)
    .maybeSingle()
  if (selErr) throw new Error(`sms_messages select: ${selErr.message}`)

  if (existing) {
    // Fill gaps only. A delivery-report stub has no body; our own send row
    // has no reference_type. Never touch status here.
    const patch = {}
    if (existing.body == null && body != null) patch.body = body
    if (existing.media == null && media) patch.media = media
    if (existing.category == null && msg.category) patch.category = msg.category
    if (existing.reference_type == null && msg.referenceType) patch.reference_type = msg.referenceType
    if (!existing.contact_id) {
      const cid = await findContactIdByPhone(sb, phone)
      if (cid) patch.contact_id = cid
    }
    if (!Object.keys(patch).length) return { unchanged: true, id: existing.id }
    patch.updated_at = new Date().toISOString()
    const { error } = await sb.from('sms_messages').update(patch).eq('id', existing.id)
    if (error) throw new Error(`sms_messages update: ${error.message}`)
    return { updated: true, id: existing.id }
  }

  const row = {
    provider: SMS_PROVIDER,
    provider_message_id: providerId,
    direction,
    contact_phone: phone,
    account_phone: toE164(msg.accountPhone),
    contact_id: await findContactIdByPhone(sb, phone),
    body,
    media,
    category: msg.category || null,
    reference_type: msg.referenceType || null,
    status: direction === 'in' ? 'received' : 'sent',
    source: opts.source || null,
    provider_ts: providerTs,
    read_at: direction === 'in' && opts.markReadBefore && providerTs < opts.markReadBefore
      ? new Date().toISOString()
      : null,
    raw: trimRaw(msg),
  }
  const { data, error } = await sb.from('sms_messages').insert(row).select('id').single()
  if (error) {
    // Lost a race with another writer on the same message: that row is now
    // there, so fold into the fill-gaps path instead of failing.
    if (error.code === '23505' && !opts._retried) {
      return upsertProviderMessage(sb, msg, { ...opts, _retried: true })
    }
    throw new Error(`sms_messages insert: ${error.message}`)
  }
  return { inserted: true, id: data.id }
}

// Record a message this app just tried to send. Called by sendSms after the
// provider answered (or refused). `result` is one of:
//   { ok: true, providerId }            -> status 'sent'
//   { blocked: reason }                 -> 409 unreachable / opted out
//   { failed: message }                 -> API error, send threw
export async function recordOutbound(sb, { to, body, sentBy, result }) {
  const phone = toE164(to)
  if (!phone) return { skipped: 'bad_phone' }
  const now = new Date().toISOString()
  const contactId = await findContactIdByPhone(sb, phone)

  const row = {
    provider: SMS_PROVIDER,
    provider_message_id: result?.providerId || null,
    direction: 'out',
    contact_phone: phone,
    account_phone: toE164(process.env.SIMPLETEXTING_PHONE) || null,
    contact_id: contactId,
    body,
    status: result?.blocked ? 'blocked' : result?.failed ? 'failed' : 'sent',
    status_detail: result?.blocked || (result?.failed ? String(result.failed).slice(0, 300) : null),
    failed_at: result?.blocked || result?.failed ? now : null,
    sent_by: sentBy || null,
    source: 'app',
    provider_ts: now,
  }

  if (!row.provider_message_id) {
    const { error } = await sb.from('sms_messages').insert(row)
    if (error) throw new Error(`sms_messages insert: ${error.message}`)
    return { inserted: true }
  }

  // A webhook (OUTGOING_MESSAGE or even DELIVERY_REPORT) may already have
  // created this row in the milliseconds since the provider accepted it. Only
  // fill in what we know better: body, who sent it, contact. Keep its status.
  const { data: existing } = await sb
    .from('sms_messages')
    .select('id, body, contact_id')
    .eq('provider_message_id', row.provider_message_id)
    .maybeSingle()
  if (existing) {
    const patch = { sent_by: row.sent_by, updated_at: now }
    if (existing.body == null) patch.body = body
    if (!existing.contact_id && contactId) patch.contact_id = contactId
    await sb.from('sms_messages').update(patch).eq('id', existing.id)
    return { updated: true }
  }
  const { error } = await sb.from('sms_messages').insert(row)
  if (error && error.code !== '23505') throw new Error(`sms_messages insert: ${error.message}`)
  return { inserted: !error }
}

// DELIVERY_REPORT / NON_DELIVERED_REPORT. values: { messageId, contactPhone,
// accountPhone, carrier, category, referenceType }. If we have never seen the
// message (sent from SimpleTexting's own UI, or the report beat our insert),
// create an outbound stub; the poll or our insert fills in the body later.
export async function applyDeliveryReport(sb, delivered, values) {
  const providerId = values?.messageId
  if (!providerId) return { skipped: 'no_message_id' }
  const now = new Date().toISOString()
  const statusPatch = delivered
    ? { status: 'delivered', delivered_at: now, carrier: values.carrier || null }
    : { status: 'undelivered', failed_at: now, carrier: values.carrier || null, status_detail: 'carrier reported not delivered' }

  const { data: existing } = await sb
    .from('sms_messages')
    .select('id, status')
    .eq('provider_message_id', providerId)
    .maybeSingle()

  if (existing) {
    // delivered is final. An undelivered that later reports delivered (carrier
    // retry) is allowed to upgrade; the reverse is not.
    if (existing.status === 'delivered' && !delivered) return { unchanged: true }
    const { error } = await sb.from('sms_messages')
      .update({ ...statusPatch, updated_at: now })
      .eq('id', existing.id)
    if (error) throw new Error(`sms_messages update: ${error.message}`)
    return { updated: true }
  }

  const phone = toE164(values.contactPhone)
  if (!phone) return { skipped: 'bad_phone' }
  const { error } = await sb.from('sms_messages').insert({
    provider: SMS_PROVIDER,
    provider_message_id: providerId,
    direction: 'out',
    contact_phone: phone,
    account_phone: toE164(values.accountPhone),
    contact_id: await findContactIdByPhone(sb, phone),
    category: values.category || null,
    reference_type: values.referenceType || null,
    source: 'webhook',
    provider_ts: now,
    raw: trimRaw(values),
    ...statusPatch,
  })
  if (error?.code === '23505') return applyDeliveryReport(sb, delivered, values)
  if (error) throw new Error(`sms_messages insert: ${error.message}`)
  return { inserted: true }
}

// STOP (webhook UNSUBSCRIBE_REPORT, or subscriptionStatus OPT_OUT on poll).
// Consent goes false on every contact sharing the number; the opt-out is
// recorded even when no contact matches.
export async function applyOptOut(sb, rawPhone, { source, providerContactId } = {}) {
  const phone = toE164(rawPhone)
  if (!phone) return { skipped: 'bad_phone' }

  const { data: prior } = await sb
    .from('sms_opt_outs')
    .select('opted_out')
    .eq('phone', phone)
    .maybeSingle()

  if (!prior?.opted_out) {
    const { error } = await sb.from('sms_opt_outs').upsert({
      phone,
      opted_out: true,
      source: source || null,
      provider_contact_id: providerContactId || null,
      changed_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
    if (error) throw new Error(`sms_opt_outs upsert: ${error.message}`)
  }

  const { data: flipped, error: cErr } = await sb
    .from('contacts')
    .update({ sms_consent: false, updated_at: new Date().toISOString() })
    .eq('phone', phone)
    .or('sms_consent.is.null,sms_consent.eq.true')
    .select('id')
  if (cErr) throw new Error(`contacts consent update: ${cErr.message}`)

  return { phone, newlyOptedOut: !prior?.opted_out, contactsUpdated: flipped?.length || 0 }
}

// Re-subscribed in SimpleTexting (texted START, or re-added by hand). Clears the
// reply block only. Does NOT set sms_consent back to true.
export async function clearOptOut(sb, rawPhone, { source } = {}) {
  const phone = toE164(rawPhone)
  if (!phone) return { skipped: 'bad_phone' }
  const { data, error } = await sb
    .from('sms_opt_outs')
    .update({ opted_out: false, source: source || null, changed_at: new Date().toISOString() })
    .eq('phone', phone)
    .eq('opted_out', true)
    .select('phone')
  if (error) throw new Error(`sms_opt_outs update: ${error.message}`)
  return { phone, cleared: (data?.length || 0) > 0 }
}

export async function isOptedOut(sb, rawPhone) {
  const phone = toE164(rawPhone)
  if (!phone) return false
  const { data } = await sb
    .from('sms_opt_outs')
    .select('opted_out')
    .eq('phone', phone)
    .maybeSingle()
  return !!data?.opted_out
}

// Bulk version of upsertProviderMessage for the sync cron: one page of up to
// 500 SimpleTexting messages in a handful of queries instead of three per
// message (a full backfill of ~2k messages would otherwise blow the 60s
// function limit). Same rules: new ids are inserted, known ids only get their
// gaps filled, status is never touched.
export async function upsertProviderMessagesBatch(sb, msgs, opts = {}) {
  const out = { inserted: 0, updated: 0, skipped: 0 }
  const clean = []
  for (const m of msgs || []) {
    const providerId = m?.id || m?.messageId
    const phone = toE164(m?.contactPhone)
    if (!providerId || !phone) { out.skipped++; continue }
    clean.push({ m, providerId, phone })
  }
  if (!clean.length) return out

  // .in() lists go in the URL, so query in chunks of 100 to stay well under
  // PostgREST's request-line limit.
  const existing = new Map()
  for (const ids of chunks(clean.map(c => c.providerId), 100)) {
    const { data, error } = await sb
      .from('sms_messages')
      .select('id, provider_message_id, body, contact_id, media, category, reference_type')
      .in('provider_message_id', ids)
    if (error) throw new Error(`sms_messages select: ${error.message}`)
    for (const r of data || []) existing.set(r.provider_message_id, r)
  }

  // phone -> freshest contact id.
  const contactRows = []
  for (const phones of chunks([...new Set(clean.map(c => c.phone))], 100)) {
    const { data, error } = await sb
      .from('contacts')
      .select('id, phone, updated_at')
      .in('phone', phones)
    if (error) throw new Error(`contacts select: ${error.message}`)
    contactRows.push(...(data || []))
  }
  const contactByPhone = new Map()
  for (const c of contactRows) {
    const cur = contactByPhone.get(c.phone)
    if (!cur || (c.updated_at || '') > (cur.updated_at || '')) contactByPhone.set(c.phone, c)
  }

  const nowIso = new Date().toISOString()
  const inserts = []
  for (const { m, providerId, phone } of clean) {
    const direction = opts.direction || (m.directionType === 'MO' ? 'in' : 'out')
    const media = Array.isArray(m.mediaItems) && m.mediaItems.length ? m.mediaItems : null
    const body = m.text ?? (m.subject || null)
    const contactId = contactByPhone.get(phone)?.id || null
    const ex = existing.get(providerId)
    if (ex) {
      const patch = {}
      if (ex.body == null && body != null) patch.body = body
      if (ex.media == null && media) patch.media = media
      if (ex.category == null && m.category) patch.category = m.category
      if (ex.reference_type == null && m.referenceType) patch.reference_type = m.referenceType
      if (!ex.contact_id && contactId) patch.contact_id = contactId
      if (Object.keys(patch).length) {
        patch.updated_at = nowIso
        const { error } = await sb.from('sms_messages').update(patch).eq('id', ex.id)
        if (error) throw new Error(`sms_messages update: ${error.message}`)
        out.updated++
      }
      continue
    }
    const providerTs = validTs(m.timestamp) || nowIso
    inserts.push({
      provider: SMS_PROVIDER,
      provider_message_id: providerId,
      direction,
      contact_phone: phone,
      account_phone: toE164(m.accountPhone),
      contact_id: contactId,
      body,
      media,
      category: m.category || null,
      reference_type: m.referenceType || null,
      status: direction === 'in' ? 'received' : 'sent',
      source: opts.source || null,
      provider_ts: providerTs,
      read_at: direction === 'in' && opts.markReadBefore && providerTs < opts.markReadBefore ? nowIso : null,
      raw: trimRaw(m),
    })
  }

  if (inserts.length) {
    // ignoreDuplicates: a webhook may have inserted one of these since the
    // select above. Its row wins; the next run fills any gap.
    const { data, error } = await sb
      .from('sms_messages')
      .upsert(inserts, { onConflict: 'provider_message_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`sms_messages bulk insert: ${error.message}`)
    out.inserted += data?.length || 0
  }
  return out
}

// Phones currently marked opted out, for the sync cron's re-subscribe check.
export async function optedOutPhones(sb) {
  const { data, error } = await sb.from('sms_opt_outs').select('phone').eq('opted_out', true)
  if (error) throw new Error(`sms_opt_outs select: ${error.message}`)
  return new Set((data || []).map(r => r.phone))
}

function chunks(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}
