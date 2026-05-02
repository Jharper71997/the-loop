'use client'

import { useState } from 'react'
import BartenderSuccessCard from '../_components/BartenderSuccessCard'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const BG_PANEL = 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'

export default function LookupClient() {
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/bartender-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contact.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || `Lookup failed (${res.status})`)
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
    return <BartenderSuccessCard result={result} mode="lookup" />
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
          Find my QR.
        </h1>
        <p style={{ color: INK_DIM, fontSize: 15, lineHeight: 1.55, margin: 0 }}>
          Enter the phone or email you signed up with. We&apos;ll pull up your QR and your personal code.
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
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            color: GOLD, fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700,
          }}>
            Phone or email
          </span>
          <input
            type="text"
            value={contact}
            onChange={e => setContact(e.target.value)}
            required
            autoComplete="email"
            placeholder="(555) 555-5555 or you@example.com"
            style={inputStyle}
          />
        </label>

        {error && (
          <div style={{
            color: '#ff8b8b',
            fontSize: 13,
            background: 'rgba(255,80,80,0.08)',
            border: '1px solid rgba(255,80,80,0.25)',
            borderRadius: 8,
            padding: '10px 12px',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !contact.trim()}
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
          {submitting ? 'Looking…' : 'Find my QR'}
        </button>
      </form>

      <p style={{ color: INK_DIM, fontSize: 13, textAlign: 'center', marginTop: 18 }}>
        New here?{' '}
        <a href="/bartender-signup" style={{ color: GOLD, fontWeight: 600, textDecoration: 'underline' }}>
          Sign up →
        </a>
      </p>
    </main>
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
