'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

// Security's side: a list of tonight's rider threads, tap to open and reply.
// Near-live via polling (threads 6s, open thread 4s).
export default function SecurityMessages({ onUnreadChange }) {
  const [threads, setThreads] = useState([])
  const [active, setActive] = useState(null) // { contact_id, name }
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/security/chat', { cache: 'no-store' })
      const json = await res.json()
      const list = json.threads || []
      setThreads(list)
      if (onUnreadChange) onUnreadChange(list.reduce((s, t) => s + (t.unread || 0), 0))
    } catch {}
  }, [onUnreadChange])

  const loadThread = useCallback(async (contactId) => {
    try {
      const res = await fetch(`/api/security/chat?contact_id=${encodeURIComponent(contactId)}`, { cache: 'no-store' })
      const json = await res.json()
      setMessages(json.messages || [])
    } catch {}
  }, [])

  // Poll the thread list whenever we're on it. (setState lands after the fetch
  // awaits, so it isn't a synchronous cascading render.)
  useEffect(() => {
    if (active) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThreads()
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadThreads() }, 6000)
    return () => clearInterval(t)
  }, [active, loadThreads])

  // Poll the open thread.
  useEffect(() => {
    if (!active) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThread(active.contact_id)
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadThread(active.contact_id) }, 4000)
    return () => clearInterval(t)
  }, [active, loadThread])

  useEffect(() => {
    if (active && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, active])

  async function send() {
    const body = input.trim()
    if (!body || sending || !active) return
    setSending(true)
    setInput('')
    setMessages(m => [...m, { id: `tmp-${m.length}`, sender: 'security', body, created_at: new Date().toISOString() }])
    try {
      await fetch('/api/security/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: active.contact_id, body }),
      })
      await loadThread(active.contact_id)
    } catch {}
    setSending(false)
  }

  // Thread view
  if (active) {
    return (
      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${LINE}` }}>
          <button type="button" onClick={() => { setActive(null); setMessages([]); loadThreads() }}
            style={{ background: 'none', border: 0, color: GOLD, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            ← Back
          </button>
          <div style={{ color: INK, fontWeight: 700, fontSize: 15 }}>{active.name || 'Rider'}</div>
        </div>

        <div ref={scrollRef} style={{ maxHeight: 320, overflowY: 'auto', padding: 12, display: 'grid', gap: 8 }}>
          {messages.length === 0 && (
            <div style={{ color: INK_DIM, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No messages yet.</div>
          )}
          {messages.map(m => <Bubble key={m.id} mine={m.sender === 'security'} body={m.body} at={m.created_at} who={m.sender === 'security' ? 'You' : active.name || 'Rider'} />)}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${LINE}` }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="Reply…"
            style={{ flex: 1, background: '#0a0a0b', border: `1px solid ${LINE}`, color: INK, padding: '10px 12px', borderRadius: 10, fontSize: 14, outline: 'none' }}
          />
          <button type="button" onClick={send} disabled={sending || !input.trim()}
            style={{ background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b', border: 0, padding: '0 16px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: sending || !input.trim() ? 'default' : 'pointer', opacity: !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </div>
    )
  }

  // Thread list
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {threads.length === 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 16px', textAlign: 'center', color: INK_DIM, fontSize: 13 }}>
          No rider messages yet tonight. They show up here when a rider messages from their ticket.
        </div>
      )}
      {threads.map(t => (
        <button
          key={t.contact_id}
          type="button"
          onClick={() => { setActive({ contact_id: t.contact_id, name: t.name }); setMessages([]) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            padding: '12px 14px', borderRadius: 12, background: SURFACE,
            border: `1px solid ${t.unread ? 'rgba(212,163,51,0.5)' : LINE}`, cursor: 'pointer', width: '100%',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: INK, fontWeight: 700, fontSize: 14 }}>{t.name || 'Rider'}</div>
            <div style={{ color: INK_DIM, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.lastSender === 'security' ? 'You: ' : ''}{t.lastBody}
            </div>
          </div>
          {t.unread > 0 && (
            <span style={{ background: GOLD, color: '#0a0a0b', fontWeight: 800, fontSize: 12, borderRadius: 999, minWidth: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
              {t.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function Bubble({ mine, body, at, who }) {
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '80%' }}>
        <div style={{
          padding: '8px 12px', borderRadius: 12,
          background: mine ? 'rgba(212,163,51,0.16)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${mine ? 'rgba(212,163,51,0.35)' : LINE}`,
          color: INK, fontSize: 14, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {body}
        </div>
        <div style={{ color: '#6f6f76', fontSize: 10, marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
          {who} · {fmt(at)}
        </div>
      </div>
    </div>
  )
}

function fmt(iso) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
}
