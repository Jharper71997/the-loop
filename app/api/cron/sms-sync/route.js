import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotCron } from '@/lib/cronAuth'
import { upsertProviderMessagesBatch, applyOptOut, clearOptOut, optedOutPhones, toE164 } from '@/lib/smsStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/cron/sms-sync            incremental (since last stored message)
// GET /api/cron/sms-sync?full=1     backfill every message SimpleTexting has
//
// Safety net and backfill for /api/simpletexting-webhook. Pages
// GET /v2/api/messages (newest first, 500 per page) and upserts each message
// on its provider id, then walks every SimpleTexting contact and mirrors
// OPT_OUT into sms_opt_outs + contacts.sms_consent = false.
//
// Idempotent: re-running changes nothing that is already stored. Reads from
// SimpleTexting only; never sends a text and never changes anything in
// SimpleTexting.
//
// Inbound messages older than 3 days are stored as already read, so the first
// backfill does not show months of old replies as unread.
//
// Auth: Bearer CRON_SECRET (Vercel cron) or EXTERNAL_CRON_SECRET (pg_cron / a
// manual curl), via lib/cronAuth.js.

const ST_API = 'https://api-app2.simpletexting.com/v2/api'
const PAGE_SIZE = 500
const MAX_PAGES = 40            // 20k messages; far above today's ~2.1k
const OVERLAP_MS = 60 * 60 * 1000
const READ_AFTER_MS = 3 * 24 * 60 * 60 * 1000

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const key = process.env.SIMPLETEXTING_API_KEY
  if (!key) return Response.json({ error: 'SIMPLETEXTING_API_KEY missing' }, { status: 500 })

  const full = new URL(req.url).searchParams.get('full') === '1'
  const sb = supabaseAdmin()
  const started = Date.now()
  const summary = { full, since: null, messages: { seen: 0, inserted: 0, updated: 0, skipped: 0 }, contacts: { seen: 0, opted_out: 0, newly_opted_out: 0, consent_flipped: 0, resubscribed: 0 }, errors: [] }

  // Incremental window: from an hour before the newest message we already
  // hold. Nothing stored yet means this is the first run, so go full.
  let since = null
  if (!full) {
    const { data: latest, error } = await sb
      .from('sms_messages')
      .select('provider_ts')
      .not('provider_message_id', 'is', null)
      .order('provider_ts', { ascending: false })
      .limit(1)
    if (error) return Response.json({ error: `sms_messages: ${error.message}` }, { status: 500 })
    if (latest?.[0]?.provider_ts) {
      since = new Date(new Date(latest[0].provider_ts).getTime() - OVERLAP_MS).toISOString()
    }
  }
  summary.since = since
  const markReadBefore = new Date(started - READ_AFTER_MS).toISOString()

  // ---- messages ----
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
    if (since) qs.set('since', since)
    let data
    try {
      data = await stGet(key, `/messages?${qs}`)
    } catch (err) {
      summary.errors.push(`messages page ${page}: ${err.message}`)
      break
    }
    const rows = data?.content || []
    summary.messages.seen += rows.length
    try {
      const r = await upsertProviderMessagesBatch(sb, rows, { source: 'poll', markReadBefore })
      summary.messages.inserted += r.inserted
      summary.messages.updated += r.updated
      summary.messages.skipped += r.skipped
    } catch (err) {
      summary.errors.push(`messages page ${page}: ${err.message}`)
      break
    }
    if (!rows.length || page + 1 >= (data?.totalPages || 0)) break
    if (Date.now() - started > 45_000) {
      summary.errors.push('time budget reached during messages; re-run with ?full=1 to finish the backfill')
      break
    }
  }

  // ---- contacts (opt-out mirror) ----
  // Always a full walk: ~260 contacts, one page. A STOP must never be missed
  // because it happened inside some "since" gap.
  let blocked
  try {
    blocked = await optedOutPhones(sb)
  } catch (err) {
    summary.errors.push(err.message)
    blocked = new Set()
  }
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() - started > 55_000) {
      summary.errors.push('time budget reached during contacts; re-run to continue')
      break
    }
    let data
    try {
      data = await stGet(key, `/contacts?page=${page}&size=${PAGE_SIZE}`)
    } catch (err) {
      summary.errors.push(`contacts page ${page}: ${err.message}`)
      break
    }
    const rows = data?.content || []
    for (const c of rows) {
      summary.contacts.seen++
      try {
        if (c.subscriptionStatus === 'OPT_OUT') {
          summary.contacts.opted_out++
          const r = await applyOptOut(sb, c.contactPhone, { source: 'poll', providerContactId: c.contactId })
          if (r.newlyOptedOut) summary.contacts.newly_opted_out++
          summary.contacts.consent_flipped += r.contactsUpdated || 0
        } else if (c.subscriptionStatus === 'OPT_IN' && blocked.has(toE164(c.contactPhone))) {
          const r = await clearOptOut(sb, c.contactPhone, { source: 'poll' })
          if (r.cleared) summary.contacts.resubscribed++
        }
      } catch (err) {
        summary.errors.push(`contact ${c?.contactId}: ${err.message}`)
      }
    }
    if (!rows.length || page + 1 >= (data?.totalPages || 0)) break
  }

  summary.ms = Date.now() - started
  const status = summary.errors.length ? 207 : 200
  return Response.json({ ok: !summary.errors.length, ...summary }, { status })
}

async function stGet(key, path) {
  const res = await fetch(`${ST_API}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`simpletexting ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}
