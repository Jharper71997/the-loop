'use client'

import { useState } from 'react'

const INK = '#e8e8ea'
const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const LINE = 'rgba(255,255,255,0.10)'
const DISPLAY = "'Orbitron', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

// Code gate for the Surf City Loop console. Mirrors the Marines LoopAdminGate
// but unlocks via /api/surf-admin (SURF_ADMIN_CODE cookie).
export default function SurfAdminGate() {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null); setSubmitting(true)
    try {
      const res = await fetch('/api/surf-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || `Failed (${res.status})`); return }
      window.location.reload()
    } catch (err) { setError(err.message || 'Network error') }
    finally { setSubmitting(false) }
  }

  return (
    <main style={{ padding: '40px 16px', display: 'grid', placeItems: 'center', minHeight: '70dvh' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 340,
        background: 'linear-gradient(180deg, rgba(212,163,51,0.04), transparent 45%), linear-gradient(180deg, #121216, #0a0a0b)',
        border: `1px solid ${LINE}`, borderRadius: 12, padding: '24px 20px', display: 'grid', gap: 14,
        boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 28px rgba(0,0,0,0.45)' }}>
        <div style={{ fontFamily: MONO, color: GOLD, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />
          Surf City · Admin
        </div>
        <div style={{ fontFamily: DISPLAY, color: INK, fontSize: 19, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Access code</div>
        <input
          autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="Enter code" type="password"
          style={{ width: '100%', padding: '12px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE}`, color: INK, fontSize: 16, outline: 'none', fontFamily: MONO, letterSpacing: '0.1em' }}
        />
        {error && <div style={{ color: '#ff8585', fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b', fontWeight: 800, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 0 24px rgba(212,163,51,0.3)' }}>
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
