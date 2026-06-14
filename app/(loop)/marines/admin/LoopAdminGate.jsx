'use client'

import { useState } from 'react'

const INK = '#eef1f3'
const INK_DIM = '#9aa3ab'
const OLIVE = '#8a9a4f'
const OLIVE_HI = '#aebb6a'
const SAND = '#c8b88f'
const SURFACE = '#1a2027'
const LINE = 'rgba(255,255,255,0.10)'

export default function LoopAdminGate() {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null); setSubmitting(true)
    try {
      const res = await fetch('/api/loop-admin', {
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
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 340, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: '24px 20px', display: 'grid', gap: 14 }}>
        <div style={{ color: SAND, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>The Loop · Admin</div>
        <div style={{ color: INK, fontSize: 18, fontWeight: 800 }}>Enter access code</div>
        <input
          autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="Access code" type="password"
          style={{ width: '100%', padding: '12px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE}`, color: INK, fontSize: 16, outline: 'none' }}
        />
        {error && <div style={{ color: '#ff8585', fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(180deg, ${OLIVE_HI}, ${OLIVE})`, color: '#13160c', fontWeight: 800, fontSize: 15, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
