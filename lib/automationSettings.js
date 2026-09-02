// DB-driven on/off flags for the Loop's automated sends + crons. Read by code
// paths before they fire (e.g. lib/booking.js, /api/cron/waiver-nudge) and
// written by /leadership/automations. See sql/029_automation_settings.sql.
//
// Defaults if the row (or the whole table) is missing: TRUE for every key
// EXCEPT the cron keys (WAIVER_NUDGE_CRON, RIDE_FEEDBACK_CRON,
// TICKET_REMINDER_CRON), which default FALSE so a newly-deployed cron can't
// start texting riders before anyone asked it to. This way introducing a new toggle never silently suppresses a
// working send, and rolling forward before the migration lands keeps the
// historical behavior.

import { supabaseAdmin } from './supabaseAdmin'

export const AUTOMATION_KEYS = {
  BOOKING_BUYER_SMS:   'booking_confirmation_buyer_sms',
  BOOKING_BUYER_EMAIL: 'booking_confirmation_buyer_email',
  BOOKING_BUYER_PUSH:  'booking_confirmation_buyer_push',
  BOOKING_RIDER_SMS:   'booking_confirmation_rider_sms',
  BOOKING_RIDER_EMAIL: 'booking_confirmation_rider_email',
  BOOKING_RIDER_PUSH:  'booking_confirmation_rider_push',
  WAIVER_NUDGE_CRON:   'waiver_nudge_cron',
  RIDE_FEEDBACK_CRON:  'ride_feedback_cron',
  TICKET_REMINDER_CRON:'ticket_reminder_cron',
  SURVEY_REWARD_EMAIL: 'survey_reward_email',
}

const DEFAULTS = {
  [AUTOMATION_KEYS.BOOKING_BUYER_SMS]:   true,
  [AUTOMATION_KEYS.BOOKING_BUYER_EMAIL]: true,
  [AUTOMATION_KEYS.BOOKING_BUYER_PUSH]:  true,
  [AUTOMATION_KEYS.BOOKING_RIDER_SMS]:   true,
  [AUTOMATION_KEYS.BOOKING_RIDER_EMAIL]: true,
  [AUTOMATION_KEYS.BOOKING_RIDER_PUSH]:  true,
  [AUTOMATION_KEYS.WAIVER_NUDGE_CRON]:   false,
  [AUTOMATION_KEYS.RIDE_FEEDBACK_CRON]:  false,
  [AUTOMATION_KEYS.TICKET_REMINDER_CRON]: false,
  // Not a cron — this one answers a rider who just finished the survey after
  // being promised a code, so it defaults TRUE like the other reply sends.
  // Switching it off while the offer email is out means those riders get
  // nothing, which is worse than not running the offer at all.
  [AUTOMATION_KEYS.SURVEY_REWARD_EMAIL]: true,
}

// Returns a Map<key, boolean> for the requested keys (or all known keys if
// `keys` is omitted). Never throws — falls back to DEFAULTS on any error.
// Reads are cheap (table is tiny) so we don't bother caching across requests.
export async function loadAutomationFlags(keys) {
  const wantKeys = keys && keys.length ? keys : Object.keys(DEFAULTS)
  const result = new Map(wantKeys.map(k => [k, DEFAULTS[k] ?? true]))

  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('automation_settings')
      .select('key, enabled')
      .in('key', wantKeys)
    if (error) {
      console.warn('[automationSettings] load failed, using defaults:', error.message)
      return result
    }
    for (const r of data || []) {
      result.set(r.key, !!r.enabled)
    }
  } catch (err) {
    console.warn('[automationSettings] load threw, using defaults:', err?.message)
  }
  return result
}

// Convenience for single-key checks. Use sparingly — prefer batching with
// loadAutomationFlags() if you're checking multiple keys in the same handler.
export async function isAutomationEnabled(key) {
  const flags = await loadAutomationFlags([key])
  return !!flags.get(key)
}

// Server action helper — toggles a single key, recording who flipped it.
// Returns { ok, enabled } or { ok: false, error }.
export async function setAutomationEnabled({ key, enabled, updatedBy }) {
  if (!key) return { ok: false, error: 'missing_key' }
  if (!(key in DEFAULTS)) return { ok: false, error: 'unknown_key' }
  try {
    const sb = supabaseAdmin()
    const { error } = await sb
      .from('automation_settings')
      .update({
        enabled: !!enabled,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      })
      .eq('key', key)
    if (error) return { ok: false, error: error.message }
    return { ok: true, enabled: !!enabled }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) }
  }
}
