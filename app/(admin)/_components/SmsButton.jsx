'use client'

import { useState } from 'react'
import { personalize } from '@/lib/personalize'

const ACCENT = '#d4a333'
const ACCENT_TXT = '#8a5f0a'

// Per-rider 1:1 text composer.
//
// Props:
//   contact: { id, first_name, last_name, phone }
//   label:   button text (default "Text")
export default function SmsButton({ contact, label = 'Text' }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  if (!contact?.phone) {
    return (
      <span title="No phone on file" style={{
        fontSize: 11, color: '#7d7060', padding: '2px 8px',
        border: '1px solid #e8ddc8', borderRadius: 999,
      }}>
        no phone
      </span>
    )
  }

  async function send() {
    if (!message.trim() || sending) return
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: contact.phone, message: personalize(message, contact) }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        setResult('sent')
        setMessage('')
        setTimeout(() => { setOpen(false); setResult(null) }, 1200)
      } else {
        setResult(json.detail || json.error || `http_${res.status}`)
      }
    } catch (err) {
      setResult(err.message)
    }
    setSending(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: 11, color: ACCENT_TXT, background: 'transparent',
        border: `1px solid ${ACCENT}`, padding: '2px 10px',
        borderRadius: 999, cursor: 'pointer',
      }}>
        {label}
      </button>
    )
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{
      display: 'grid', gap: 6, padding: 8,
      background: '#faf5ea', border: `1px solid ${ACCENT}`, borderRadius: 8,
      minWidth: 240,
    }}>
      <div style={{ fontSize: 11, color: '#6e6154' }}>To {contact.first_name} ({contact.phone})</div>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Hey {first_name}…"
        rows={2}
        style={{
          background: '#fdfaf3', border: '1px solid #e8ddc8', color: '#17130f',
          padding: '6px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => { setOpen(false); setMessage(''); setResult(null) }} style={{
          fontSize: 11, color: '#6e6154', background: 'transparent', border: 0, cursor: 'pointer',
        }}>Cancel</button>
        {result && (
          <span style={{ fontSize: 11, color: result === 'sent' ? '#0f7a4e' : '#b3311f' }}>
            {result === 'sent' ? '✓ Sent' : result}
          </span>
        )}
        <button onClick={send} disabled={sending || !message.trim()} style={{
          fontSize: 11, color: '#231903', background: ACCENT, border: 0,
          padding: '4px 10px', borderRadius: 6, fontWeight: 700,
          opacity: sending || !message.trim() ? 0.4 : 1, cursor: sending ? 'wait' : 'pointer',
        }}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
