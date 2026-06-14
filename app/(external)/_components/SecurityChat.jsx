'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

// Rider's side of the chat with security. Identity = the boarding-pass code in
// the URL, so no login. Near-live via a 5s poll (pauses when the tab's hidden).
export default function SecurityChat({ code }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [disabled, setDisabled] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.disabled) { setDisabled(true); return }
      setMessages(json.messages || [])
    } catch {}
  }, [code])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 5000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, open])

  async function send() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setInput('')
    // Optimistic bubble.
    setMessages(m => [...m, { id: `tmp-${m.length}`, sender: 'rider', body, created_at: new Date().toISOString() }])
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, body }),
      })
      await load()
    } catch {}
    setSending(false)
  }

  if (disabled) return null

  const unreadFromSecurity = messages.some(m => m.sender === 'security')

  // Closed: a floating gold pill pinned bottom-right, always visible no matter
  // how far the rider has scrolled. Sits clear of the centered QR so it never
  // blocks the scan at the door.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Message security"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '13px 20px', borderRadius: 999,
          background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b',
          border: 0, fontWeight: 800, fontSize: 15, cursor: 'pointer',
          boxShadow: '0 12px 32px rgba(212,163,51,0.45), 0 0 0 1px rgba(0,0,0,0.2)',
        }}
      >
        <span style={{ fontSize: 17, lineHeight: 1 }}>💬</span>
        <span>Security</span>
        {unreadFromSecurity && (
          <span style={{
            width: 10, height: 10, borderRadius: 999, background: '#e07a7a',
            boxShadow: '0 0 0 2px #0a0a0b', marginLeft: 2,
          }} />
        )}
      </button>
    )
  }

  // Open: a floating panel anchored to the same corner (bottom sheet on phones).
  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 60,
        width: 'min(380px, calc(100vw - 32px))',
        background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${LINE}`, background: 'rgba(212,163,51,0.06)' }}>
        <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
          Message security
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" style={{ background: 'none', border: 0, color: INK_DIM, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 2 }}>
          ×
        </button>
      </div>

      <div ref={scrollRef} style={{ maxHeight: 'min(48vh, 320px)', overflowY: 'auto', padding: 12, display: 'grid', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ color: INK_DIM, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            Message security if you can&rsquo;t find the pickup or need help at the door.
          </div>
        )}
        {messages.map(m => <Bubble key={m.id} mine={m.sender === 'rider'} body={m.body} at={m.created_at} />)}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${LINE}` }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Type a message…"
          autoFocus
          style={{
            flex: 1, background: '#0a0a0b', border: `1px solid ${LINE}`, color: INK,
            padding: '10px 12px', borderRadius: 10, fontSize: 16, outline: 'none', minWidth: 0,
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b',
            border: 0, padding: '0 16px', borderRadius: 10, fontWeight: 700, fontSize: 14,
            cursor: sending || !input.trim() ? 'default' : 'pointer', opacity: !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function Bubble({ mine, body, at }) {
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
          {mine ? 'You' : 'Security'} · {fmt(at)}
        </div>
      </div>
    </div>
  )
}

function fmt(iso) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
}
