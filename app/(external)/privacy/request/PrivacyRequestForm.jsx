'use client'

import { useState } from 'react'
import { GOLD, GOLD_HI, INK, INK_DIM, LINE, LINE_HI, SURFACE, ON_GOLD } from '@/lib/marketingTheme'

const TYPES = [
  { key: 'delete', label: 'Delete my data' },
  { key: 'access', label: 'Send me a copy' },
  { key: 'correct', label: 'Fix something' },
  { key: 'sms_optout', label: 'Stop all texts' },
  { key: 'other', label: 'Something else' },
]

export default function PrivacyRequestForm() {
  const [type, setType] = useState('delete')
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setError('')
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/privacy-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          details: fd.get('details'),
          company: fd.get('company'),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || 'Something went wrong. Try again in a moment.')
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setError('We could not reach the server. Try again in a moment.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div role="status" style={{ padding: '20px 22px', borderRadius: 14, border: `1px solid ${GOLD}`, background: 'rgba(212,163,51,0.08)', color: INK, fontSize: 15.5, lineHeight: 1.6 }}>
        Got it. We will reply to the email you gave within 10 days to confirm, then finish the request within 30 days.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16, marginTop: 6 }} aria-describedby="pr-help">
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={label}>What would you like?</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map(t => {
            const on = type === t.key
            return (
              <label key={t.key} style={{
                padding: '10px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: on ? 'rgba(212,163,51,0.14)' : 'transparent',
                border: `1px solid ${on ? GOLD : LINE_HI}`,
                color: on ? GOLD_HI : INK_DIM,
              }}>
                <input
                  type="radio"
                  name="type"
                  value={t.key}
                  checked={on}
                  onChange={() => setType(t.key)}
                  style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                />
                {t.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Field name="name" label="Your name" autoComplete="name" required />
        <Field name="email" label="Email we can reply to" type="email" autoComplete="email" required />
      </div>
      <Field name="phone" label="Phone you booked with (helps us find you)" type="tel" autoComplete="tel" />
      <div>
        <label htmlFor="pr-details" style={label}>Anything we should know? (optional)</label>
        <textarea id="pr-details" name="details" rows={4} style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="pr-company">Company</label>
        <input id="pr-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {error && <p role="alert" style={{ color: '#f0c24a', fontSize: 14, margin: 0 }}>{error}</p>}

      <button
        type="submit"
        disabled={state === 'sending'}
        style={{
          padding: '14px 20px', borderRadius: 12, border: 0, fontWeight: 800, fontSize: 16,
          background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: ON_GOLD,
          cursor: state === 'sending' ? 'default' : 'pointer', opacity: state === 'sending' ? 0.7 : 1,
        }}
      >
        {state === 'sending' ? 'Sending…' : 'Send request'}
      </button>
      <p id="pr-help" style={{ color: INK_DIM, fontSize: 13, lineHeight: 1.55, margin: 0 }}>
        We only use these details to handle this request.
      </p>
    </form>
  )
}

function Field({ name, label: text, type = 'text', ...rest }) {
  return (
    <div>
      <label htmlFor={`pr-${name}`} style={label}>{text}</label>
      <input id={`pr-${name}`} name={name} type={type} style={input} {...rest} />
    </div>
  )
}

const label = { display: 'block', color: INK, fontSize: 13, fontWeight: 700, marginBottom: 8 }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
  background: SURFACE, border: `1px solid ${LINE}`, color: INK, fontSize: 16, margin: 0,
}
