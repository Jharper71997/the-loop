'use client'

// The one inbound form on the marketing site. Posts to /api/contact, which
// emails CONTACT.email with reply-to set to the sender.
//
// The topic preselects from ?topic= so links like /contact?topic=sponsor (from
// the sponsors page) land people on the right question instead of a blank form.

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CONTACT } from '../_components/site/nav'
import {
  GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, LINE, LINE_HI, SURFACE,
  primaryCta,
} from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'

const TOPICS = [
  { key: 'ride', label: 'Riding the Loop' },
  { key: 'group', label: 'Group / private charter' },
  { key: 'sponsor', label: 'Sponsorship or partner pack' },
  { key: 'bar', label: 'Becoming a partner bar' },
  { key: 'other', label: 'Something else' },
]

export default function ContactForm() {
  const params = useSearchParams()
  const initialTopic = TOPICS.some(t => t.key === params.get('topic')) ? params.get('topic') : 'ride'

  const [topic, setTopic] = useState(initialTopic)
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setError('')

    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          message: fd.get('message'),
          company: fd.get('company'),
          topic,
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
      setError(`We couldn’t send that. Email ${CONTACT.email} or call ${CONTACT.phoneDisplay}.`)
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div style={litCard({ radius: 20 })}>
        <div style={{ ...litCardInner({ radius: 19, pad: 'clamp(28px, 5vw, 40px)' }), textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(212,163,51,0.14)', border: `1px solid ${GOLD}`, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD_HI} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 style={{ color: INK, fontSize: 22, fontWeight: 800, margin: 0 }}>Got it.</h2>
          <p style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.55, margin: '10px auto 0', maxWidth: 380 }}>
            We read every message and usually write back the same day. If it&rsquo;s urgent, call{' '}
            <a href={`tel:${CONTACT.phone}`} style={{ color: GOLD_HI, fontWeight: 700 }}>{CONTACT.phoneDisplay}</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={litCard({ radius: 20 })}>
    <form onSubmit={onSubmit} style={litCardInner({ radius: 19, pad: 'clamp(22px, 4vw, 32px)' })}>
      {/* Topic */}
      <div style={label}>What&rsquo;s this about?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {TOPICS.map(t => {
          const on = t.key === topic
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTopic(t.key)}
              aria-pressed={on}
              style={{
                padding: '12px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
                background: on ? 'rgba(212,163,51,0.14)' : 'transparent',
                border: `1px solid ${on ? GOLD : LINE_HI}`,
                color: on ? GOLD_HI : INK_DIM,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Field name="name" label="Your name" autoComplete="name" required />
        <Field name="email" label="Email" type="email" autoComplete="email" required />
      </div>
      <div style={{ marginTop: 16 }}>
        <Field name="phone" label="Phone" hint="Optional" type="tel" autoComplete="tel" />
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={label} htmlFor="c-message">Message</label>
        <textarea
          id="c-message"
          name="message"
          rows={5}
          required
          placeholder="Tell us what you need and we’ll come back with real answers."
          style={{ ...input, resize: 'vertical', minHeight: 120, fontFamily: 'inherit' }}
        />
      </div>

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="c-company">Company</label>
        <input id="c-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" style={{ color: '#ff9b8a', fontSize: 14, lineHeight: 1.5, margin: '16px 0 0' }}>{error}</p>
      )}

      <button type="submit" disabled={state === 'sending'} style={{ ...primaryCta, width: '100%', marginTop: 22, opacity: state === 'sending' ? 0.65 : 1 }}>
        {state === 'sending' ? 'Sending…' : 'Send it'}
      </button>
      <p style={{ color: INK_MUTE, fontSize: 12.5, lineHeight: 1.5, margin: '14px 0 0', textAlign: 'center' }}>
        Goes straight to {CONTACT.email}. No list, no spam.
      </p>
    </form>
    </div>
  )
}

function Field({ name, label: text, hint, type = 'text', ...rest }) {
  return (
    <div>
      <label style={label} htmlFor={`c-${name}`}>
        {text}
        {hint && <span style={{ color: INK_MUTE, fontWeight: 500, letterSpacing: 0, textTransform: 'none', marginLeft: 6 }}>{hint}</span>}
      </label>
      <input id={`c-${name}`} name={name} type={type} style={input} {...rest} />
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
