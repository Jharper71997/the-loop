import webpush from 'web-push'
import { supabaseAdmin } from './supabaseAdmin'

let configured = false
function configure() {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subj = process.env.VAPID_SUBJECT || 'mailto:jacob@jvillebrewloop.com'
  if (!pub || !priv) return false
  webpush.setVapidDetails(subj, pub, priv)
  configured = true
  return true
}

// Send a push notification to every subscription tied to a contact. Failures
// per-subscription are tolerated (404/410 from a stale endpoint cause us to
// drop the row). Returns counts so callers can record outcomes.
//
// Payload: { title, body, url?, tag? }
//   title — line 1 in the OS notification
//   body  — line 2
//   url   — opens this URL when tapped (defaults to /my-tickets)
//   tag   — coalesces repeats (browser dedupe key); pass per-event so a new
//           push replaces the old one rather than stacking
export async function sendPushToContact(contactId, payload) {
  if (!contactId) return { skipped: 'no_contact' }
  if (!configure()) return { skipped: 'no_vapid' }

  const supabase = supabaseAdmin()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('contact_id', contactId)
  if (error || !subs?.length) return { sent: 0, dropped: 0, total: 0 }

  const result = await deliver(supabase, subs, payload)
  if (result.sent > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ last_pushed_at: new Date().toISOString() })
      .eq('contact_id', contactId)
  }
  return result
}

// Send to every subscription tagged with a role (e.g. 'security'). Used to
// alert whoever's working the door of a new rider message.
export async function sendPushToRole(role, payload) {
  if (!role) return { skipped: 'no_role' }
  if (!configure()) return { skipped: 'no_vapid' }

  const supabase = supabaseAdmin()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('role', role)
  if (error || !subs?.length) return { sent: 0, dropped: 0, total: 0 }

  return deliver(supabase, subs, payload)
}

// Shared delivery loop: fan a payload out to subscriptions, dropping dead ones.
async function deliver(supabase, subs, payload) {
  let sent = 0
  let dropped = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
      sent++
    } catch (err) {
      const status = err?.statusCode || 0
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        dropped++
      } else {
        console.error('[push] send failed', sub.endpoint, status, err?.message)
      }
    }
  }
  return { sent, dropped, total: subs.length }
}
