import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushToRole } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Customer side of the rider ↔ security chat. Identity is the boarding-pass
// code (same unguessable token that gates /tickets/<code>) — no login. One
// thread per rider, keyed by the order_item's contact_id.

const RATE_PER_MIN = 20
const hits = new Map()
function rateLimited(key) {
  if (!key) return false
  const now = Date.now()
  const recent = (hits.get(key) || []).filter(t => now - t < 60_000)
  if (recent.length >= RATE_PER_MIN) { hits.set(key, recent); return true }
  recent.push(now); hits.set(key, recent)
  return false
}

// Resolve a boarding-pass code → { contactId, orderId, eventId, riderName }.
async function resolveCode(sb, code) {
  if (!code) return null
  const { data: qr } = await sb
    .from('qr_codes').select('order_item_id, kind').eq('code', code).maybeSingle()
  if (!qr || qr.kind !== 'checkin' || !qr.order_item_id) return null
  const { data: item } = await sb
    .from('order_items')
    .select('id, contact_id, order_id, voided_at, rider_first_name, rider_last_name, order:orders ( event_id )')
    .eq('id', qr.order_item_id)
    .maybeSingle()
  if (!item || item.voided_at || !item.contact_id) return null
  return {
    contactId: item.contact_id,
    orderId: item.order_id || null,
    eventId: item.order?.event_id || null,
    riderName: [item.rider_first_name, item.rider_last_name].filter(Boolean).join(' ') || 'Rider',
  }
}

// GET /api/chat?code=... → { messages, riderName }
export async function GET(req) {
  const code = new URL(req.url).searchParams.get('code')
  const sb = supabaseAdmin()
  const who = await resolveCode(sb, code)
  if (!who) return Response.json({ messages: [], disabled: true })

  const { data: messages } = await sb
    .from('security_messages')
    .select('id, sender, body, created_at')
    .eq('contact_id', who.contactId)
    .order('created_at', { ascending: true })
    .limit(200)

  // Mark security → rider messages as read now that the rider is looking.
  await sb.from('security_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('contact_id', who.contactId)
    .eq('sender', 'security')
    .is('read_at', null)

  return Response.json({ messages: messages || [], riderName: who.riderName })
}

// POST /api/chat  { code, body } → { ok }
export async function POST(req) {
  let payload
  try { payload = await req.json() } catch { return Response.json({ error: 'bad json' }, { status: 400 }) }
  const code = String(payload?.code || '').trim()
  const body = String(payload?.body || '').trim().slice(0, 1000)
  if (!body) return Response.json({ error: 'empty' }, { status: 400 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || code
  if (rateLimited(ip)) return Response.json({ error: 'rate_limited' }, { status: 429 })

  const sb = supabaseAdmin()
  const who = await resolveCode(sb, code)
  if (!who) return Response.json({ error: 'invalid_code' }, { status: 404 })

  const { error } = await sb.from('security_messages').insert({
    contact_id: who.contactId,
    order_id: who.orderId,
    event_id: who.eventId,
    sender: 'rider',
    body,
  })
  if (error) {
    console.error('[chat] rider insert failed', error)
    return Response.json({ error: 'send_failed' }, { status: 500 })
  }

  // Alert whoever's working the door (best-effort).
  try {
    await sendPushToRole('security', {
      title: `Message from ${who.riderName}`,
      body: body.slice(0, 120),
      url: '/admin/security',
      tag: `chat-${who.contactId}`,
    })
  } catch (err) {
    console.error('[chat] security push failed', err)
  }

  return Response.json({ ok: true })
}
