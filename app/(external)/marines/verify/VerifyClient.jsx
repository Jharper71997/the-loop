'use client'

import { useState } from 'react'
import { prefixLink } from '@/lib/businessConfig'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#8a8a90'
const LINE = 'rgba(255,255,255,0.08)'
const SURFACE = '#15151a'
const RED = '#e07a7a'
const GREEN = '#6fbf7f'

export default function VerifyClient() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dodId, setDodId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null) // null | { firstName }

  const dodDigits = dodId.replace(/\D/g, '')
  const canSubmit = firstName.trim() && phone.replace(/\D/g, '').length >= 10 && dodDigits.length === 10

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/marines/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone, email, dodId: dodDigits }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Something went wrong. Try again.')
        setSubmitting(false)
        return
      }
      setDone({ firstName: json.firstName || firstName })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <main style={{ padding: '16px 14px 28px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'grid', gap: 16, textAlign: 'center' }}>
          <div style={{ ...card, padding: '28px 22px', background: 'linear-gradient(180deg, rgba(111,191,127,0.10), rgba(111,191,127,0.03))', border: '1px solid rgba(111,191,127,0.35)' }}>
            <div style={{ fontSize: 40, color: GREEN, lineHeight: 1 }}>&#10003;</div>
            <h1 style={{ color: INK, fontSize: 24, fontWeight: 800, margin: '12px 0 6px' }}>
              You&rsquo;re cleared to ride{done.firstName ? `, ${done.firstName}` : ''}.
            </h1>
            <p style={{ color: INK_DIM, fontSize: 14.5, margin: 0, lineHeight: 1.5 }}>
              That&rsquo;s a one-time thing. Grab a ride whenever you need one, the driver just checks your
              ID at the door.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ ...card, padding: '14px 12px' }}>
              <div style={{ color: INK, fontSize: 13, fontWeight: 800 }}>Single Ride</div>
              <div style={{ color: GOLD_HI, fontSize: 22, fontWeight: 800 }}>$10</div>
            </div>
            <div style={{ ...card, padding: '14px 12px', border: '1px solid rgba(212,163,51,0.5)', background: 'rgba(212,163,51,0.10)' }}>
              <div style={{ color: GOLD_HI, fontSize: 13, fontWeight: 800 }}>Day Pass</div>
              <div style={{ color: GOLD_HI, fontSize: 22, fontWeight: 800 }}>$20</div>
            </div>
          </div>

          <a href={prefixLink('/events', 'marines')} style={primaryCta}>Get a ride &rarr;</a>
          <a href={prefixLink('/track', 'marines')} style={{ color: GOLD, fontSize: 13, textDecoration: 'none' }}>Or see the shuttle live &rarr;</a>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div>
          <div style={eyebrow}>Marines only &middot; one-time</div>
          <h1 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>
            Verify you&rsquo;re a Marine.
          </h1>
          <p style={{ color: INK_DIM, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Enter the 10-digit DoD ID off the back of your military ID. You do this once, then you&rsquo;re
            cleared to ride. The driver still checks your card at the door.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ ...card, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" required />
            <Field label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
          </div>
          <Field label="Phone" value={phone} onChange={setPhone} type="tel" inputMode="tel" autoComplete="tel" placeholder="(910) 555 0123" required />
          <Field label="Email (optional)" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@example.com" />

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={fieldLabel}>DoD ID (10 digits)</span>
            <input
              value={dodId}
              onChange={e => setDodId(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              placeholder="10-digit number on your CAC"
              style={{ ...input, letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}
              required
            />
            <span style={{ color: INK_MUTED, fontSize: 11 }}>
              {dodDigits.length}/10 digits. It&rsquo;s the long number on the back of your ID card.
            </span>
          </label>

          {error && (
            <div style={{ color: RED, fontSize: 13, padding: '8px 12px', background: 'rgba(224,122,122,0.08)', borderRadius: 8, lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !canSubmit} style={{ ...primaryCta, border: 0, cursor: submitting ? 'wait' : 'pointer', opacity: submitting || !canSubmit ? 0.6 : 1 }}>
            {submitting ? 'Verifying…' : 'Verify to ride'}
          </button>
          <p style={{ color: INK_MUTED, fontSize: 11, textAlign: 'center', margin: 0, lineHeight: 1.4 }}>
            Your DoD ID confirms you&rsquo;re a service member and is kept private. The Loop is for Marines
            and the military community at Camp Lejeune.
          </p>
        </form>
      </div>
    </main>
  )
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} style={input} {...rest} />
    </label>
  )
}

const card = { background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14 }
const eyebrow = { color: GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }
const fieldLabel = { color: INK_DIM, fontSize: 12, letterSpacing: '0.06em', fontWeight: 600 }
const input = {
  width: '100%', padding: '13px 13px', borderRadius: 10, border: `1px solid rgba(255,255,255,0.12)`,
  background: 'rgba(255,255,255,0.03)', color: INK, fontSize: 16, outline: 'none', boxSizing: 'border-box',
}
const primaryCta = { display: 'block', textAlign: 'center', padding: '15px 22px', borderRadius: 12, background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 10px 30px rgba(212,163,51,0.25)' }
