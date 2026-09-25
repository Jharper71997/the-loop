import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { serverNow } from '@/lib/serverNow'
import { toE164 } from '@/lib/smsStore'
import LiveStamp from '@/app/(leadership)/_components/LiveStamp'
import StatusBadge from '@/app/(leadership)/_components/StatusBadge'
import { T } from '@/app/_components/console/theme'
import { prettyPhone, contactName, fullWhen, statusBadge } from '../format'
import ThreadActions from './ThreadActions'

export const dynamic = 'force-dynamic'

const LIMIT = 300

export default async function ThreadPage({ params }) {
  const { phone: slug } = await params
  const phone = toE164(slug)
  if (!phone) notFound()

  const renderedAt = await serverNow()
  const sb = supabaseAdmin()

  const [msgRes, contactRes, optRes] = await Promise.all([
    sb.from('sms_messages')
      .select('id, direction, body, media, status, status_detail, carrier, sent_by, reference_type, provider_ts, read_at')
      .eq('contact_phone', phone)
      .order('provider_ts', { ascending: false })
      .limit(LIMIT),
    sb.from('contacts')
      .select('id, first_name, last_name, email, sms_consent, updated_at')
      .eq('phone', phone)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(5),
    sb.from('sms_opt_outs').select('opted_out, changed_at').eq('phone', phone).maybeSingle(),
  ])

  if (msgRes.error) console.error('[admin/messages/thread]', msgRes.error)
  const messages = (msgRes.data || []).slice().reverse()
  const contacts = contactRes.data || []
  const contact = contacts[0] || null
  const name = contactName(contact)
  const optedOut = !!optRes.data?.opted_out
  const hasInbound = messages.some(m => m.direction === 'in')
  const unread = messages.filter(m => m.direction === 'in' && !m.read_at).length
  // sms_consent false = never ticked the box for automated texts. A person
  // answering someone who texted us is fine; starting a conversation cold with
  // them is not, so say so.
  const noConsentCold = contact && contact.sms_consent === false && !hasInbound

  return (
    <main style={page}>
      <div style={wrap}>
        <Link href="/admin/messages" style={backLink}>← All texts</Link>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', margin: '10px 0 4px' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={h1}>{name || prettyPhone(phone)}</h1>
            <div style={{ fontSize: 13, color: T.DIM, fontFamily: T.MONO }}>
              {name ? prettyPhone(phone) : 'Not matched to a rider'}
              {contact?.email ? <span style={{ fontFamily: T.SANS }}> · {contact.email}</span> : null}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {optedOut
                ? <StatusBadge label="texted stop" tone="red" />
                : <StatusBadge label="subscribed" tone="green" />}
              {contact && (contact.sms_consent
                ? <StatusBadge label="ride texts: yes" tone="gold" title="Ticked the text box at checkout" />
                : <StatusBadge label="ride texts: no" tone="grey" title="Did not tick the text box, or texted STOP" />)}
              {contacts.length > 1 && <StatusBadge label={`${contacts.length} riders share this number`} tone="blue" />}
            </div>
          </div>
          <LiveStamp renderedAt={renderedAt} intervalMs={30_000} />
        </div>

        <section style={thread} aria-label="Conversation">
          {messages.length === 0 && (
            <div style={{ color: T.DIM, fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
              No messages with this number yet.
            </div>
          )}
          {messages.length === LIMIT && (
            <div style={{ color: T.FAINT, fontSize: 12, textAlign: 'center', paddingBottom: 8 }}>
              Showing the latest {LIMIT} messages.
            </div>
          )}
          {messages.map(m => {
            const mine = m.direction === 'out'
            const [label, tone] = statusBadge(m.status)
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%' }}>
                  <div style={bubble(mine)}>
                    {m.body
                      ? m.body
                      : <em style={{ opacity: 0.7 }}>{m.media ? 'Picture or file (open in SimpleTexting to view)' : 'No text stored'}</em>}
                    {m.body && m.media && (
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>+ attachment</div>
                    )}
                  </div>
                  <div style={{ ...meta, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <span>{fullWhen(m.provider_ts)}</span>
                    {mine && m.sent_by && <span>· {m.sent_by.split('@')[0]}</span>}
                    {mine && !m.sent_by && m.reference_type === 'INB' && <span>· SimpleTexting inbox</span>}
                    {mine && <StatusBadge label={label} tone={tone} title={[m.status_detail, m.carrier].filter(Boolean).join(' · ') || undefined} />}
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        <ThreadActions
          phone={phone}
          optedOut={optedOut}
          unread={unread}
          warnNoConsent={!!noConsentCold}
        />
      </div>
    </main>
  )
}

const page = { minHeight: '100vh', background: T.PAPER, color: T.INK, padding: '24px 16px 64px', fontFamily: T.SANS }
const wrap = { maxWidth: 760, margin: '0 auto' }
const backLink = { color: T.DIM, fontSize: 13, fontWeight: 500, textDecoration: 'none' }
const h1 = { fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 2px', overflowWrap: 'anywhere' }
const thread = { display: 'flex', flexDirection: 'column', gap: 10, background: T.CARD, border: `1px solid ${T.LINE}`, borderRadius: 10, padding: '16px 12px', marginTop: 18 }
const meta = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, color: T.FAINT, marginTop: 4 }
function bubble(mine) {
  return {
    background: mine ? T.INK : T.SUNK,
    color: mine ? T.PAPER : T.INK,
    borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
    padding: '9px 12px',
    fontSize: 14.5,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  }
}
