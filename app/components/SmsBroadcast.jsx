'use client'

import { useMemo, useState } from 'react'
import { personalize } from '@/lib/personalize'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

// Reusable broadcast composer.
//
// Props:
//   recipients: [{ id, first_name, last_name, phone, current_stop_index? }]
//   stops:      optional [{ name, start_time }] — adds a "filter by stop" dropdown
//   title:      header label (default "Text riders")
//   defaultMessage: optional starter text
export default function SmsBroadcast({ recipients = [], stops = null, title = 'Text riders', defaultMessage = '' }) {
  const [message, setMessage] = useState(defaultMessage)
  const [stopFilter, setStopFilter] = useState('all') // 'all' | stop index as string
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const targets = useMemo(() => {
    let list = recipients.filter(r => r.phone)
    if (stops && stopFilter !== 'all') {
      const idx = Number(stopFilter)
      list = list.filter(r => r.current_stop_index === idx)
    }
    return list
  }, [recipients, stops, stopFilter])

  async function send() {
    if (!message.trim() || !targets.length || sending) return
    if (!confirm(`Send to ${targets.length} rider${targets.length === 1 ? '' : 's'}?`)) return
    setSending(true)
    setResult(null)
    const results = await Promise.all(
      targets.map(r =>
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: r.phone, message: personalize(message, r) }),
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }))
      )
    )
    const failed = results.filter(r => !r.success).length
    setSending(false)
    setResult({ sent: targets.length - failed, failed })
    if (failed === 0) setMessage('')
  }

  const noPhones = recipients.length > 0 && recipients.every(r => !r.phone)

  return (
    <section style={{
      background: SURFACE, border: `1px solid ${ACCENT}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 13, color: ACCENT, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
        <span style={{ fontSize: 11, color: '#9c9ca3' }}>
          {targets.length} of {recipients.length} have a phone
        </span>
      </div>

      {recipients.length === 0 && (
        <p style={{ color: '#9c9ca3', margin: 0, fontSize: 13 }}>No riders to text.</p>
      )}

      {noPhones && (
        <p style={{ color: '#facc15', margin: 0, fontSize: 13 }}>None of these riders have a phone on file.</p>
      )}

      {recipients.length > 0 && !noPhones && (
        <>
          {stops && stops.length > 0 && (
            <select value={stopFilter} onChange={e => setStopFilter(e.target.value)} style={input}>
              <option value="all">All riders ({recipients.filter(r => r.phone).length})</option>
              {stops.map((s, i) => {
                const cnt = recipients.filter(r => r.phone && r.current_stop_index === i).length
                return (
                  <option key={i} value={String(i)}>
                    {i + 1}. {s.name} ({cnt})
                  </option>
                )
              })}
            </select>
          )}

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Hey {first_name}, see you tonight at 8pm!"
            rows={3}
            style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ fontSize: 11, color: '#6f6f76' }}>
            Use <code>{'{first_name}'}</code> to personalize.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            {result ? (
              <span style={{ color: result.failed === 0 ? '#10b981' : '#facc15', fontSize: 13 }}>
                Sent {result.sent}{result.failed > 0 ? ` · ${result.failed} failed` : ''}
              </span>
            ) : <span />}
            <button
              onClick={send}
              disabled={sending || !message.trim() || !targets.length}
              style={{
                background: ACCENT, color: '#0a0a0b', border: 0,
                padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                opacity: sending || !message.trim() || !targets.length ? 0.4 : 1,
                cursor: sending ? 'wait' : 'pointer',
              }}
            >
              {sending ? 'Sending…' : `Send to ${targets.length}`}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

const input = {
  background: '#0a0a0b',
  border: `1px solid ${BORDER}`,
  color: '#fff',
  padding: '8px 10px',
  borderRadius: 8,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}
