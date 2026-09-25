'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/app/_components/console/theme'

const MAX_LEN = 640

// Reply box + mark-as-read for one thread. A person types, a person presses
// Send, one text goes to one number. Locked when the number texted STOP.
export default function ThreadActions({ phone, optedOut, unread, warnNoConsent }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  // Opening the thread reads it.
  useEffect(() => {
    if (!unread) return
    fetch('/api/admin/sms/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).then(() => router.refresh()).catch(() => {})
  }, [phone, unread, router])

  async function send(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/sms/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, body: text }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) {
        setBody('')
        setMsg({ tone: 'ok', text: 'Sent.' })
      } else {
        setMsg({ tone: 'err', text: j.detail || 'Not sent.' })
      }
      router.refresh()
    } catch {
      setMsg({ tone: 'err', text: 'Network error. Not sent.' })
    } finally {
      setBusy(false)
    }
  }

  if (optedOut) {
    return (
      <div style={lockBox}>
        This number texted STOP, so replies are off. If they text START they can be
        messaged again.
      </div>
    )
  }

  const len = body.length
  return (
    <form onSubmit={send} style={formBox}>
      {warnNoConsent && (
        <div style={warn}>
          This rider did not opt in to texts and has not texted us. Only reply if they
          reached out another way.
        </div>
      )}
      <label htmlFor="reply" style={{ fontSize: 12, fontWeight: 700, color: T.DIM, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Reply
      </label>
      <textarea
        id="reply"
        value={body}
        onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
        rows={3}
        placeholder="Type a text to this one person"
        style={textarea}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e) }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: len > 160 ? T.GOLD_TXT : T.FAINT }}>
          {len}/{MAX_LEN}{len > 160 ? ' · sends as more than one text' : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {msg && (
            <span role="status" style={{ fontSize: 13, fontWeight: 600, color: msg.tone === 'ok' ? T.GREEN_TXT : T.RED_TXT }}>
              {msg.text}
            </span>
          )}
          <button type="submit" disabled={busy || !body.trim()} style={btn(busy || !body.trim())}>
            {busy ? 'Sending' : 'Send'}
          </button>
        </span>
      </div>
    </form>
  )
}

const formBox = { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, background: T.CARD, border: `1px solid ${T.LINE}`, borderRadius: 10, padding: 14 }
const textarea = { width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 80, fontFamily: T.SANS, fontSize: 15, lineHeight: 1.45, color: T.INK, background: T.CARD_ALT, border: `1px solid ${T.LINE_HI}`, borderRadius: 8, padding: '10px 12px' }
const lockBox = { marginTop: 14, background: T.RED_BG, color: T.RED_TXT, borderRadius: 10, padding: '14px 16px', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }
const warn = { background: T.GOLD_BG, color: T.GOLD_TXT, borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }
function btn(disabled) {
  return {
    background: disabled ? T.SUNK : T.GOLD,
    color: disabled ? T.FAINT : T.ON_GOLD,
    border: 'none', borderRadius: 8, padding: '10px 22px',
    fontSize: 14, fontWeight: 800, cursor: disabled ? 'default' : 'pointer',
  }
}
