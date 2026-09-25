import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { serverNow } from '@/lib/serverNow'
import LiveStamp from '@/app/(leadership)/_components/LiveStamp'
import StatusBadge from '@/app/(leadership)/_components/StatusBadge'
import { T } from '@/app/_components/console/theme'
import { prettyPhone, phoneSlug, contactName, shortWhen } from './format'

export const dynamic = 'force-dynamic'

// The text inbox. Every conversation on the Brew Loop number, newest first,
// with unread replies on top of mind. Fed by sms_messages (sql/056), which the
// SimpleTexting webhook and the sms-sync cron keep current.

export default async function MessagesPage({ searchParams }) {
  const sp = await searchParams
  const unreadOnly = sp?.filter === 'unread'
  const renderedAt = await serverNow()
  const sb = supabaseAdmin()

  let q = sb
    .from('sms_threads')
    .select('contact_phone, last_at, last_body, last_direction, last_status, contact_id, unread')
    .order('last_at', { ascending: false })
    .limit(200)
  if (unreadOnly) q = q.gt('unread', 0)
  const { data: threads, error } = await q

  if (error) {
    console.error('[admin/messages] threads', error)
    return (
      <main style={page}>
        <div style={wrap}>
          <h1 style={h1}>Texts</h1>
          <div style={errBox}>
            Could not load messages ({error.code || error.message}). If this is the first
            deploy, sql/056_sms_messages.sql has not been applied yet.
          </div>
        </div>
      </main>
    )
  }

  const rows = threads || []
  const phones = rows.map(t => t.contact_phone)

  // Names: match by phone, not only by the stored contact_id, so a number that
  // became a contact after it first texted still shows a name.
  const byPhone = new Map()
  const optedOut = new Set()
  if (phones.length) {
    const [{ data: contacts }, { data: opts }] = await Promise.all([
      sb.from('contacts').select('id, first_name, last_name, phone, updated_at').in('phone', phones),
      sb.from('sms_opt_outs').select('phone').eq('opted_out', true).in('phone', phones),
    ])
    for (const c of contacts || []) {
      const cur = byPhone.get(c.phone)
      if (!cur || (c.updated_at || '') > (cur.updated_at || '')) byPhone.set(c.phone, c)
    }
    for (const o of opts || []) optedOut.add(o.phone)
  }

  const totalUnread = rows.reduce((s, t) => s + (t.unread || 0), 0)

  return (
    <main style={page}>
      <div style={wrap}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={h1}>Texts</h1>
            <p style={sub}>
              Replies to the Brew Loop number, and everything we sent. Open a thread to
              answer one person. Nothing here sends on its own.
            </p>
          </div>
          <LiveStamp renderedAt={renderedAt} intervalMs={30_000} />
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '18px 0 12px' }}>
          <Link href="/admin/messages" style={chip(!unreadOnly)}>All</Link>
          <Link href="/admin/messages?filter=unread" style={chip(unreadOnly)}>
            Unread{totalUnread && !unreadOnly ? ` (${totalUnread})` : ''}
          </Link>
        </div>

        {rows.length === 0 ? (
          <div style={emptyBox}>
            {unreadOnly ? 'No unread replies.' : 'No messages yet. They show up here once the SimpleTexting sync has run.'}
          </div>
        ) : (
          <ul style={list}>
            {rows.map(t => {
              const c = byPhone.get(t.contact_phone)
              const name = contactName(c)
              const unread = t.unread || 0
              const preview = (t.last_body || '').replace(/\s+/g, ' ').trim()
              return (
                <li key={t.contact_phone} style={{ borderTop: `1px solid ${T.LINE}` }}>
                  <Link href={`/admin/messages/${phoneSlug(t.contact_phone)}`} style={rowLink}>
                    <span style={{ ...dot, visibility: unread ? 'visible' : 'hidden' }} aria-hidden="true" />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: unread ? 800 : 600, fontSize: 15, color: T.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {name || prettyPhone(t.contact_phone)}
                        </span>
                        <span style={{ fontSize: 12, color: unread ? T.GOLD_TXT : T.FAINT, fontWeight: unread ? 700 : 500, whiteSpace: 'nowrap' }}>
                          {shortWhen(t.last_at, renderedAt)}
                        </span>
                      </span>
                      {name && (
                        <span style={{ display: 'block', fontSize: 12, color: T.FAINT, marginTop: 1, fontFamily: T.MONO }}>
                          {prettyPhone(t.contact_phone)}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: unread ? T.INK_2 : T.DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.last_direction === 'out' ? 'You: ' : ''}{preview || (t.last_direction === 'out' ? '(no text)' : '(media)')}
                        </span>
                        {optedOut.has(t.contact_phone) && <StatusBadge label="stopped" tone="red" title="Texted STOP" />}
                        {unread > 0 && <span style={badge}>{unread}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {rows.length === 200 && (
          <p style={foot}>Showing the 200 most recent conversations.</p>
        )}
      </div>
    </main>
  )
}

const page = { minHeight: '100vh', background: T.PAPER, color: T.INK, padding: '24px 16px 64px', fontFamily: T.SANS }
const wrap = { maxWidth: 760, margin: '0 auto' }
const h1 = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 4px' }
const sub = { color: T.DIM, fontSize: 13.5, lineHeight: 1.55, margin: 0, maxWidth: 520 }
const list = { listStyle: 'none', margin: 0, padding: 0, background: T.CARD, border: `1px solid ${T.LINE}`, borderRadius: 10, overflow: 'hidden' }
const rowLink = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '13px 14px', textDecoration: 'none', color: 'inherit' }
const dot = { width: 8, height: 8, borderRadius: 99, background: T.GOLD, marginTop: 7, flex: '0 0 8px' }
const badge = { background: T.GOLD, color: T.ON_GOLD, fontSize: 11, fontWeight: 800, minWidth: 20, height: 20, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }
const emptyBox = { background: T.CARD, border: `1px dashed ${T.LINE_HI}`, borderRadius: 10, padding: '28px 16px', textAlign: 'center', color: T.DIM, fontSize: 14 }
const errBox = { background: T.RED_BG, color: T.RED_TXT, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, marginTop: 16 }
const foot = { color: T.FAINT, fontSize: 12.5, marginTop: 14 }
function chip(on) {
  return {
    fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 99, textDecoration: 'none',
    background: on ? T.GOLD : T.CARD, color: on ? T.ON_GOLD : T.INK_2,
    border: `1px solid ${on ? T.GOLD : T.LINE}`,
  }
}
