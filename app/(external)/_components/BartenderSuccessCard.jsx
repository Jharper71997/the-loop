'use client'

import { useState } from 'react'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const BG_PANEL = 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'

// Shared success-card UI rendered after either /api/bartender-signup or
// /api/bartender-lookup. Same payload shape from both endpoints.
//
// `mode` controls the headline:
//   "signup" → "You're in"     (used by SignupClient)
//   "lookup" → "Welcome back"  (used by LookupClient)
export default function BartenderSuccessCard({ result, mode = 'signup' }) {
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

  const eyebrow = mode === 'lookup' ? 'Welcome back' : "You're in"

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          color: GOLD, fontSize: 11, letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 12,
        }}>
          {eyebrow}
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
            Works on the app and Ticket Tailor — every ticket with that code counts toward your total.
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
