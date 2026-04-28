'use client'

import { useMemo, useState } from 'react'

// Ad-hoc broadcast modal. Sends one personalized SMS per recipient via
// /api/send-sms, with a 120ms delay between sends (matches the root-script
// GHL pattern). Never group MMS — per memory, always individual SMS.
export default function BroadcastModal({ contacts, onClose }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null) // { sent, failed, errors: [{ contactId, name, error }] }
  const [alsoPush, setAlsoPush] = useState(true)
  const [title, setTitle] = useState('Brew Loop')

  const preview = useMemo(() => {
    if (!contacts.length) return ''
    return render(body, contacts[0])
  }, [body, contacts])

  const valid = body.trim().length > 0 && contacts.length > 0

  async function onSend() {
    if (!valid || sending) return
    setSending(true)
    const sentOk = []
    const failed = []
    for (const c of contacts) {
      const message = render(body, c)
      try {
        const res = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: c.phone, message }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json.success) {
          sentOk.push(c.id)
        } else {
          failed.push({ contactId: c.id, name: displayName(c), error: json.error || `HTTP ${res.status}` })
        }
      } catch (err) {
        failed.push({ contactId: c.id, name: displayName(c), error: err.message })
      }
      // Push runs in parallel with the SMS spacing — silent if no subscription.
      if (alsoPush && c.id) {
        try {
          await fetch('/api/admin/push-broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact_id: c.id, title, body: message, url: '/my-tickets' }),
          })
        } catch {}
      }
      await sleep(130)
    }
    setResults({ sent: sentOk.length, failed: failed.length, errors: failed })
    setSending(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '5vh 16px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'linear-gradient(180deg, #16161c, #121216)',
          border: '1px solid #2a2a31',
          borderRadius: 14,
          padding: '18px 18px 20px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h2 style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#d4a333',
            margin: 0,
          }}>
            Broadcast SMS
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', color: '#9c9ca3', border: 0, fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ color: '#e8e8ea', fontSize: 15, marginBottom: 12 }}>
          To <span style={{ color: '#f0c24a', fontWeight: 700 }}>{contacts.length}</span> recipient{contacts.length === 1 ? '' : 's'}
        </div>

        {results ? (
          <Results results={results} onClose={onClose} />
        ) : (
          <>
            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ color: '#9c9ca3', fontSize: 12 }}>
                Message · use <code style={{ fontFamily: "'JetBrains Mono', monospace", color: '#d4a333' }}>{'{{first_name}}'}</code> for personalization
              </span>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                placeholder="Hey {{first_name}}, quick note about this weekend's Loop…"
                style={{
                  width: '100%',
                  padding: '12px 12px',
                  borderRadius: 8,
                  border: '1px solid #2a2a31',
                  background: '#0a0a0b',
                  color: '#f5f5f7',
                  fontSize: 15,
                  lineHeight: 1.5,
                  resize: 'vertical',
                  minHeight: 110,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            {preview && (
              <div
                style={{
                  padding: '12px 14px',
                  background: '#1a1a22',
                  border: '1px dashed #2a2a31',
                  borderRadius: 8,
                  marginBottom: 14,
                }}
              >
                <div style={{ color: '#9c9ca3', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                  Preview for {displayName(contacts[0])}
                </div>
                <div style={{ color: '#f5f5f7', fontSize: 14, whiteSpace: 'pre-wrap' }}>{preview}</div>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#c8c8cc', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={alsoPush}
                onChange={e => setAlsoPush(e.target.checked)}
              />
              Also send push notification to subscribed devices (free)
            </label>
            {alsoPush && (
              <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                <span style={{ color: '#9c9ca3', fontSize: 12 }}>Push title (line 1)</span>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #2a2a31',
                    background: '#0a0a0b',
                    color: '#f5f5f7',
                    fontSize: 14,
                  }}
                />
              </label>
            )}

            <div style={{ color: '#6f6f76', fontSize: 12, marginBottom: 12 }}>
              Each recipient gets their own SMS. Sends are spaced ~130ms apart.
              {contacts.some(c => !c.phone) && (
                <div style={{ color: '#e07a7a', marginTop: 4 }}>
                  ⚠ {contacts.filter(c => !c.phone).length} selected recipient(s) have no phone number — they&apos;ll fail.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={sending}
                className="btn-subtle"
                style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #2a2a31', background: 'transparent', color: '#c8c8cc', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={onSend}
                disabled={!valid || sending}
                style={{
                  padding: '10px 22px',
                  borderRadius: 8,
                  border: 0,
                  background: valid ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : '#2a2a31',
                  color: valid ? '#0a0a0b' : '#6f6f76',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  cursor: valid && !sending ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase',
                }}
              >
                {sending ? 'Sending…' : `Send ${contacts.length}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Results({ results, onClose }) {
  const { sent, failed, errors } = results
  return (
    <div>
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 10,
          background: failed === 0 ? 'rgba(111,191,127,0.08)' : 'rgba(212,163,51,0.08)',
          border: `1px solid ${failed === 0 ? 'rgba(111,191,127,0.3)' : 'rgba(212,163,51,0.3)'}`,
          marginBottom: 14,
        }}
      >
        <div style={{ color: '#f5f5f7', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          {failed === 0 ? `Sent to ${sent}` : `Sent to ${sent}, ${failed} failed`}
        </div>
        <div style={{ color: '#9c9ca3', fontSize: 13 }}>
          {failed === 0 ? 'All recipients received their personalized SMS.' : 'Failures listed below.'}
        </div>
      </div>

      {errors.length > 0 && (
        <div style={{ marginBottom: 14, maxHeight: 240, overflowY: 'auto' }}>
          {errors.map(e => (
            <div
              key={e.contactId}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #1e1e23',
                fontSize: 13,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span style={{ color: '#f5f5f7' }}>{e.name}</span>
              <span style={{ color: '#e07a7a', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                {e.error}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'right' }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 22px',
            borderRadius: 8,
            border: 0,
            background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
            color: '#0a0a0b',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function render(tmpl, contact) {
  const first = contact.first_name?.trim() || 'friend'
  return tmpl.replace(/\{\{\s*first_name\s*\}\}/g, first)
}

function displayName(c) {
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  return name || c.phone || 'Unknown'
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
