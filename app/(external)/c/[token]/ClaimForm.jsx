'use client'

import { useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'
const RED = '#e07a7a'

export default function ClaimForm({ token, event, waiver }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [smsConsent, setSmsConsent] = useState(true)
  const [typedName, setTypedName] = useState('')
  const [waiverOpen, setWaiverOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const valid = !!(first && last && (phone || email) && typedName.trim())

  async function onSubmit(e) {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/claim/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          phone,
          email,
          sms_consent: smsConsent,
          typed_name: typedName.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error === 'already_claimed' ? 'Someone already claimed this seat.' : (json.error || 'Could not claim.'))
        setSubmitting(false)
        return
      }
      if (json.ticket_url) {
        window.location.href = json.ticket_url
      } else {
        window.location.href = '/my-tickets'
      }
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const dateLabel = event?.event_date ? formatDate(event.event_date) : null
  const time = event?.pickup_time ? ` · ${formatTime(event.pickup_time)}` : ''

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
      {dateLabel && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(212,163,51,0.08)',
          border: '1px solid rgba(212,163,51,0.3)',
          borderRadius: 10,
          color: GOLD,
          fontSize: 13,
          textAlign: 'center',
        }}>
          {dateLabel}{time}
        </div>
      )}

      <Section title="Your info">
        <Row>
          <Field label="First name" value={first} onChange={setFirst} autoFocus />
          <Field label="Last name" value={last} onChange={setLast} />
        </Row>
        <Row>
          <Field label="Phone" type="tel" value={phone} onChange={setPhone} />
          <Field label="Email" type="email" value={email} onChange={setEmail} />
        </Row>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: INK_DIM }}>
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={e => setSmsConsent(e.target.checked)}
          />
          Text me my pickup details and the live tracking link.
        </label>
      </Section>

      <Section title="Waiver">
        <button
          type="button"
          onClick={() => setWaiverOpen(o => !o)}
          style={btnGhost}
        >
          {waiverOpen ? 'Hide' : 'Read'} waiver{waiver?.version ? ` (v${waiver.version})` : ''}
        </button>
        {waiverOpen && waiver && (
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: 13,
            color: '#ddd',
            background: '#0e0e12',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 12,
            margin: 0,
            maxHeight: 280,
            overflowY: 'auto',
          }}>{waiver.body_md}</pre>
        )}
        <label style={{ fontSize: 13, color: INK_DIM, marginTop: 8 }}>
          Type your full legal name to sign:
        </label>
        <input
          value={typedName}
          onChange={e => setTypedName(e.target.value)}
          placeholder="Your full legal name"
          style={inputStyle}
        />
        {typedName && (
          <div style={{ fontSize: 11, color: INK_DIM, marginTop: -4 }}>
            Signed by {typedName} · {new Date().toLocaleDateString('en-US')}
          </div>
        )}
      </Section>

      {error && (
        <div style={{
          padding: 10,
          background: '#3a1a1a',
          border: `1px solid ${RED}`,
          borderRadius: 8,
          color: RED,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || submitting}
        style={{
          padding: '16px 24px',
          borderRadius: 12,
          background: valid && !submitting ? `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})` : '#5a4720',
          color: '#0a0a0b',
          border: 0,
          fontWeight: 700,
          fontSize: 16,
          cursor: valid && !submitting ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Claiming…' : 'Claim my ticket'}
      </button>
    </form>
  )
}

function Section({ title, children }) {
  return (
    <section style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 14,
      display: 'grid',
      gap: 10,
    }}>
      <h2 style={{
        fontSize: 13,
        color: GOLD,
        margin: 0,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>
}

function Field({ label, value, onChange, type = 'text', autoFocus = false }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: INK_DIM }}>
      {label}
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  )
}

const inputStyle = {
  background: '#0a0a0b',
  border: `1px solid ${BORDER}`,
  color: INK,
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}

const btnGhost = {
  background: 'transparent',
  border: `1px solid ${BORDER}`,
  color: GOLD,
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
