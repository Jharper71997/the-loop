'use client'

// The public request form for a private outing. Posts to /api/party-request,
// which stores the lead in party_requests and emails us.
//
// Deliberately NOT a checkout. Nothing here takes money or holds a date —
// every party is quoted on its own, so this collects exactly what we need to
// put a number on the night and nothing else. Every field past the first four
// is optional, because a request we can answer beats a form somebody abandons.

import { useState } from 'react'
import { CONTACT } from '../_components/site/nav'
import { GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, LINE, SURFACE, primaryCta } from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'

const OCCASIONS = [
  'Bachelor / bachelorette',
  'Birthday',
  'Work / team night',
  'Reunion or family',
  'Something else',
]

export default function PartyRequestForm() {
  const [occasion, setOccasion] = useState(OCCASIONS[0])
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setError('')

    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/party-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          requested_date: fd.get('requested_date'),
          party_size: fd.get('party_size'),
          notes: fd.get('notes'),
          company: fd.get('company'), // honeypot
          occasion,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || 'Something went wrong. Try again in a second.')
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setError(`We couldn’t send that. Text ${CONTACT.phoneDisplay} and we’ll pick it up.`)
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div style={litCard({ radius: 20 })}>
        <div style={{ ...litCardInner({ radius: 19, pad: 'clamp(28px, 5vw, 40px)' }), textAlign: 'center' }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%', background: 'rgba(212,163,51,0.14)',
            border: `1px solid ${GOLD}`, display: 'grid', placeItems: 'center', margin: '0 auto 16px',
            color: GOLD_HI, fontSize: 20, fontWeight: 800,
          }}>
            ✓
          </div>
          <h2 style={{ color: INK, fontSize: 22, fontWeight: 800, margin: 0 }}>We’ve got your night.</h2>
          <p style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.55, margin: '10px auto 0', maxWidth: 420 }}>
            We’ll come back with one flat price for the whole shuttle, usually the
            same day. If you need it faster, call or text{' '}
            <a href={`tel:${CONTACT.phone}`} style={{ color: GOLD_HI, fontWeight: 700 }}>{CONTACT.phoneDisplay}</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={litCard({ radius: 20 })}>
      <form onSubmit={onSubmit} style={litCardInner({ radius: 19, pad: 'clamp(24px, 4vw, 34px)' })}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <Field name="name" label="Your name" required autoComplete="name" />
          <Field name="phone" label="Mobile" hint="how we reply" type="tel" required autoComplete="tel" />
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 16 }}>
          <Field name="email" label="Email" type="email" autoComplete="email" />
          {/* Not required. Plenty of people ask before the date is settled,
              and refusing them a quote over a blank field is a lost booking. */}
          <Field name="requested_date" label="Date" hint="or roughly when" type="date" />
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 16 }}>
          <Field name="party_size" label="How many people" type="number" min="1" max="60" inputMode="numeric" required />
          <div>
            <label style={label} htmlFor="p-occasion">Occasion</label>
            <select
              id="p-occasion"
              value={occasion}
              onChange={e => setOccasion(e.target.value)}
              style={{ ...input, appearance: 'none' }}
            >
              {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={label} htmlFor="p-notes">
            Bars you want
            <span style={{ color: INK_MUTE, fontWeight: 500, letterSpacing: 0, textTransform: 'none', marginLeft: 6 }}>
              or anything else we should know
            </span>
          </label>
          <textarea
            id="p-notes"
            name="notes"
            rows={4}
            placeholder="We know we want to start at Voodoo and end somewhere with food."
            style={{ ...input, resize: 'vertical', minHeight: 110, fontFamily: 'inherit' }}
          />
        </div>

        {/* Honeypot. Real browsers leave it empty; bots fill it and the API
            silently 200s so they never learn to retry. */}
        <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <input name="company" tabIndex={-1} autoComplete="off" />
        </div>

        {error && (
          <p role="alert" style={{ color: '#ff9b8a', fontSize: 14, lineHeight: 1.5, margin: '16px 0 0' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={state === 'sending'}
          style={{ ...primaryCta, width: '100%', marginTop: 22, opacity: state === 'sending' ? 0.65 : 1 }}
        >
          {state === 'sending' ? 'Sending…' : 'Request your night'}
        </button>

        <p style={{ color: INK_MUTE, fontSize: 12.5, lineHeight: 1.5, margin: '14px 0 0', textAlign: 'center' }}>
          No charge, no hold on the date. We reply with a price.
        </p>
      </form>
    </div>
  )
}

function Field({ name, label: text, hint, type = 'text', ...rest }) {
  return (
    <div>
      <label style={label} htmlFor={`p-${name}`}>
        {text}
        {hint && (
          <span style={{ color: INK_MUTE, fontWeight: 500, letterSpacing: 0, textTransform: 'none', marginLeft: 6 }}>
            {hint}
          </span>
        )}
      </label>
      <input id={`p-${name}`} name={name} type={type} style={input} {...rest} />
    </div>
  )
}

const label = {
  display: 'block', color: INK, fontSize: 11.5, fontWeight: 800,
  letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 9,
}
const input = {
  width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: 11,
  background: SURFACE, border: `1px solid ${LINE}`, color: INK, fontSize: 15.5,
  outline: 'none',
}
