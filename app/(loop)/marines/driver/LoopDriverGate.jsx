'use client'

import { useState } from 'react'
import { C } from '../../_theme'

// Code entry for the standalone Loop driver surface. Clone of LoopAdminGate,
// red theme, posts to /api/loop-driver. Drivers run the shuttle from their
// phone after entering LOOP_DRIVER_CODE once.
export default function LoopDriverGate() {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null); setSubmitting(true)
    try {
      const res = await fetch('/api/loop-driver', {
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
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 340, background: C.SURFACE, border: `1px solid ${C.LINE}`, borderRadius: 14, padding: '24px 20px', display: 'grid', gap: 14 }}>
        <div style={{ color: C.WARM, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>The Loop · Driver</div>
        <div style={{ color: C.INK, fontSize: 18, fontWeight: 800 }}>Enter access code</div>
        <input
          autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="Access code" type="password"
          style={{ width: '100%', padding: '12px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.LINE}`, color: C.INK, fontSize: 16, outline: 'none' }}
        />
        {error && <div style={{ color: '#ff8585', fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(180deg, ${C.RED_HI}, ${C.RED})`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
