'use client'

import { useEffect, useState } from 'react'
import BartenderSuccessCard from '../_components/BartenderSuccessCard'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const BG_PANEL = 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'

export default function SignupClient({ bars }) {
  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [barSlug, setBarSlug] = useState(bars[0]?.slug || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setCode(params.get('code') || '')
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/bartender-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          bar_slug: barSlug,
          code,
          email: email.trim(),
          phone: phone.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || `Signup failed (${res.status})`)
        return
      }
      setResult(data)
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return <BartenderSuccessCard result={result} mode="signup" />
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          color: GOLD, fontSize: 11, letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 12,
        }}>
          Bartender Contest
        </div>
        <h1 style={{ color: INK, fontSize: 28, margin: '0 0 12px' }}>
          Get your sales QR.
        </h1>
        <p style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.55, margin: 0 }}>
          Top seller this month wins <strong style={{ color: GOLD }}>$250</strong>.
          Runner-up gets <strong style={{ color: GOLD }}>$50</strong>. Sell at least 10 to qualify.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          background: BG_PANEL,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Field label="First name">
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
            style={inputStyle}
          />
        </Field>

        <Field label="Your bar">
          <select
            value={barSlug}
            onChange={e => setBarSlug(e.target.value)}
            required
            style={inputStyle}
          >
            {bars.map(b => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="(555) 555-5555"
            style={inputStyle}
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            style={inputStyle}
          />
        </Field>

        <p style={{ color: INK_DIM, fontSize: 12, margin: '-4px 0 0', lineHeight: 1.5 }}>
          We need at least one — that&apos;s how we&apos;ll send you your prize.
        </p>

        {error && (
          <div style={{
            color: '#ff8b8b',
            fontSize: 13,
            background: 'rgba(255,80,80,0.08)',
            border: '1px solid rgba(255,80,80,0.25)',
            borderRadius: 8,
            padding: '10px 12px',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !firstName.trim() || !barSlug || (!email.trim() && !phone.trim())}
          style={{
            background: GOLD,
            color: '#0a0a0b',
            border: 'none',
            borderRadius: 10,
            padding: '14px 18px',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            minHeight: 48,
          }}
        >
          {submitting ? 'Generating QR…' : "I'm in — get my QR"}
        </button>
      </form>

      <p style={{ color: INK_DIM, fontSize: 12, textAlign: 'center', marginTop: 18 }}>
        One entry per person. The leaderboard resets the 1st of every month.
      </p>

      <p style={{ color: INK_DIM, fontSize: 13, textAlign: 'center', marginTop: 16 }}>
        Already signed up?{' '}
        <a href="/bartender-qr" style={{ color: GOLD, fontWeight: 600, textDecoration: 'underline' }}>
          Find my QR →
        </a>
      </p>
    </main>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        color: GOLD, fontSize: 10, letterSpacing: '0.2em',
        textTransform: 'uppercase', fontWeight: 700,
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const inputStyle = {
  background: '#0d0d10',
  color: INK,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 16,
  fontFamily: 'inherit',
  width: '100%',
  minHeight: 48,
}
