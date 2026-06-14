import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { canCheckIn } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Security side of the rider ↔ security chat. Gated to the security allowlist
// (same as the door scanner). Threads are keyed by contact_id; the list is
// scoped to the last ~18h so it shows tonight's loop without manual filtering.

const WINDOW_MS = 18 * 60 * 60 * 1000

async function requireSecurity() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'unauthenticated', status: 401 }
  if (!canCheckIn(user.email)) return { error: 'forbidden', status: 403 }
  return { user }
}

// GET /api/security/chat            → { threads: [{ contact_id, name, lastBody, lastAt, unread }] }
// GET /api/security/chat?contact_id → { messages, name }
export async function GET(req) {
  const auth = await requireSecurity()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const sb = supabaseAdmin()
  const contactId = new URL(req.url).searchParams.get('contact_id')

  if (contactId) {
    const { data: messages } = await sb
      .from('security_messages')
      .select('id, sender, body, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true })
      .limit(200)
    // Mark rider → security messages read now that security opened the thread.
    await sb.from('security_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('contact_id', contactId)
      .eq('sender', 'rider')
      .is('read_at', null)
    const { data: c } = await sb
      .from('contacts').select('first_name, last_name').eq('id', contactId).maybeSingle()
    const name = c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : 'Rider'
    return Response.json({ messages: messages || [], name: name || 'Rider' })
  }

  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data: rows } = await sb
    .from('security_messages')
    .select('contact_id, sender, body, created_at, read_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000)

  // Roll up to one entry per contact: newest message + count of unread rider msgs.
  const byContact = new Map()
  for (const m of rows || []) {
    let t = byContact.get(m.contact_id)
    if (!t) {
      t = { contact_id: m.contact_id, lastBody: m.body, lastAt: m.created_at, lastSender: m.sender, unread: 0 }
      byContact.set(m.contact_id, t)
    }
    if (m.sender === 'rider' && !m.read_at) t.unread += 1
  }
  const threads = [...byContact.values()]
  const ids = threads.map(t => t.contact_id)
  if (ids.length) {
    const { data: contacts } = await sb
      .from('contacts').select('id, first_name, last_name').in('id', ids)
    const nameById = new Map((contacts || []).map(c => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Rider']))
    for (const t of threads) t.name = nameById.get(t.contact_id) || 'Rider'
  }
  threads.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
  return Response.json({ threads })
}

// POST /api/security/chat  { contact_id, body } → { ok }
export async function POST(req) {
  const auth = await requireSecurity()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  let payload
  try { payload = await req.json() } catch { return Response.json({ error: 'bad json' }, { status: 400 }) }
  const contactId = String(payload?.contact_id || '').trim()
  const body = String(payload?.body || '').trim().slice(0, 1000)
  if (!contactId || !body) return Response.json({ error: 'missing' }, { status: 400 })

  const sb = supabaseAdmin()
  // Copy order/event context from the rider's latest message so the reply is
  // tagged to the same loop.
  const { data: ctx } = await sb
    .from('security_messages')
    .select('order_id, event_id')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await sb.from('security_messages').insert({
    contact_id: contactId,
    order_id: ctx?.order_id || null,
    event_id: ctx?.event_id || null,
    sender: 'security',
    body,
  })
  if (error) {
    console.error('[security chat] insert failed', error)
    return Response.json({ error: 'send_failed' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
