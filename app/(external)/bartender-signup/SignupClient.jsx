'use client'

import { useEffect, useState } from 'react'

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
    return <SuccessCard result={result} />
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
    </main>
  )
}

function SuccessCard({ result }) {
  const [copied, setCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(result.referral_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(result.share_code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1500)
    } catch {}
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          color: GOLD, fontSize: 11, letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 12,
        }}>
          You're in
        </div>
        <h1 style={{ color: INK, fontSize: 26, margin: '0 0 8px' }}>
          {result.display_name} — {result.bar}
        </h1>
        <p style={{ color: INK_DIM, fontSize: 14, margin: 0 }}>
          Two ways to get credit: the QR, or your personal code.
        </p>
      </div>

      {result.share_code && (
        <div style={{
          background: BG_PANEL,
          border: `1px solid ${GOLD}`,
          borderRadius: 14,
          padding: 20,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <div style={{
            color: GOLD, fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 10,
          }}>
            Your code
          </div>
          <div style={{
            color: INK,
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 12,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}>
            {result.share_code}
          </div>
          <p style={{ color: INK_DIM, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
            Tell riders: <strong style={{ color: INK }}>“type {result.share_code} at checkout”</strong>.
            No phone, no link — every ticket with that code counts toward your total.
          </p>
          <button
            onClick={copyCode}
            style={{
              background: 'transparent',
              color: GOLD,
              border: `1px solid ${GOLD}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              width: '100%',
              minHeight: 44,
            }}
          >
            {codeCopied ? 'Copied' : 'Copy code'}
          </button>
        </div>
      )}

      <div style={{
        background: BG_PANEL,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 16,
        textAlign: 'center',
      }}>
        {result.qr_image_url ? (
          <a href={result.qr_image_url} download={`brewloop-${result.slug}.png`}>
            <img
              src={result.qr_image_url}
              alt={`QR code for ${result.display_name}`}
              style={{ width: '100%', maxWidth: 320, borderRadius: 10, display: 'block', margin: '0 auto' }}
            />
          </a>
        ) : (
          <div style={{ color: INK_DIM, padding: 40, fontSize: 14 }}>
            QR generation pending. Use the link below in the meantime.
          </div>
        )}
        <p style={{ color: INK_DIM, fontSize: 12, margin: '12px 0 0' }}>
          Tap the QR to save it to your phone.
        </p>
      </div>

      <div style={{
        background: BG_PANEL,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}>
        <div style={{
          color: GOLD, fontSize: 10, letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 8,
        }}>
          Your link
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          color: INK,
          fontSize: 13,
          wordBreak: 'break-all',
          marginBottom: 12,
        }}>
          {result.referral_url}
        </div>
        <button
          onClick={copyUrl}
          style={{
            background: 'transparent',
            color: GOLD,
            border: `1px solid ${GOLD}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            width: '100%',
            minHeight: 44,
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <a
        href={result.leaderboard_url}
        style={{
          display: 'block',
          background: GOLD,
          color: '#0a0a0b',
          textDecoration: 'none',
          borderRadius: 10,
          padding: '14px 18px',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textAlign: 'center',
          minHeight: 48,
        }}
      >
        See the leaderboard →
      </a>

      <div style={{
        color: INK_DIM, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 1.6,
      }}>
        $250 to #1 · $50 to #2 · 10 sales to qualify · resets monthly
      </div>
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
