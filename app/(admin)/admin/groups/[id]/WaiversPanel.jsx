'use client'

import { useState } from 'react'

export default function WaiversPanel({ groupId, members }) {
  const total = members.length
  const signed = members.filter(m => m.has_signed_waiver).length
  const unsigned = members.filter(m => !m.has_signed_waiver)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  async function nudgeAll({ force = false } = {}) {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/waiver-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, force }),
      })
      const json = await res.json()
      setResult(json)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setSending(false)
    }
  }

  async function nudgeOne(contactId) {
    setSending(true)
    try {
      await fetch('/api/waiver-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, force: true }),
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="hud-heading">Waivers</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 6 }}>
        <div>
          <div className="stat">{signed}<span style={{ color: '#6f6f76' }}>/{total}</span></div>
          <div className="stat-label">Signed</div>
        </div>
        <div style={{ flex: 1 }} />
        {unsigned.length > 0 && (
          <button
            className="btn-primary"
            style={{ width: 'auto' }}
            disabled={sending}
            onClick={() => nudgeAll({ force: false })}
          >
            {sending ? 'Sending…' : `Text ${unsigned.length} unsigned`}
          </button>
        )}
      </div>

      {result && (
        <div className="muted" style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
          {result.error
            ? `✗ ${result.error}`
            : `✓ ${result.sent}/${result.total} texted${result.results?.some(r => r.skipped === 'deduped') ? ' (some deduped, last 24h)' : ''}`}
        </div>
      )}

      {unsigned.length > 0 && (
        <>
          <hr className="divider" />
          <div style={{ display: 'grid', gap: 6 }}>
            {unsigned.map(m => (
              <div key={m.id} className="row" style={{
                padding: '8px 10px',
                background: '#0e0e12',
                border: '1px solid #1e1e23',
                borderRadius: 6,
                fontSize: 13,
              }}>
                <div>
                  <strong>{m.first_name} {m.last_name}</strong>
                  <span className="rider-phone" style={{ marginLeft: 8, display: 'inline' }}>{m.phone || '—'}</span>
                  {m.waiver_sms_sent_at && (
                    <div className="tiny" style={{ marginTop: 2 }}>
                      last texted {timeAgo(m.waiver_sms_sent_at)}
                    </div>
                  )}
                </div>
                <button
                  className="btn-subtle"
                  disabled={sending || !m.phone}
                  onClick={() => nudgeOne(m.id)}
                >
                  Text
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
