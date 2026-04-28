'use client'

import { useEffect, useState } from 'react'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

// Banner that prompts the rider to enable push notifications. Renders after
// a successful booking (or anywhere the contactId is known). Hides itself
// when:
//   - the browser doesn't support push
//   - permission is already 'granted' (already on)
//   - permission is 'denied' (no recovery without OS-level reset)
//   - dismissed by the user this session
//   - VAPID public key is unset (env not configured)
//
// On enable:
//   1. Register /sw.js (idempotent — existing PWA SW is reused)
//   2. Request Notification.permission
//   3. pushManager.subscribe with the VAPID key
//   4. POST the subscription + contact_id to /api/push/subscribe
export default function EnableNotifications({ contactId }) {
  const [state, setState] = useState('idle') // idle | working | done | error | hidden
  const [error, setError] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('hidden'); return
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState('hidden'); return
    }
    if (Notification.permission === 'granted') {
      setState('hidden'); return
    }
    if (Notification.permission === 'denied') {
      setState('hidden'); return
    }
    if (sessionStorage.getItem('brewloop_push_dismissed') === '1') {
      setState('hidden'); return
    }
  }, [])

  async function enable() {
    setState('working')
    setError(null)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const ready = await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') throw new Error('notifications_blocked')

      const sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId || null,
          subscription: sub.toJSON(),
          user_agent: navigator.userAgent,
        }),
      })
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`)
      setState('done')
    } catch (err) {
      console.error('[push] enable failed', err)
      setError(err.message || 'Could not enable notifications')
      setState('error')
    }
  }

  function dismiss() {
    sessionStorage.setItem('brewloop_push_dismissed', '1')
    setState('hidden')
  }

  if (state === 'hidden' || state === 'done') return null

  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 14,
      display: 'grid',
      gap: 10,
    }}>
      <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
        Get pickup updates
      </div>
      <div style={{ color: INK, fontSize: 14 }}>
        Skip the texts — get a notification on your phone the second the shuttle is close.
      </div>
      {error && (
        <div style={{ color: '#e07a7a', fontSize: 12 }}>
          {error === 'notifications_blocked'
            ? 'Notifications are blocked in your browser settings. Enable them and try again.'
            : error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={enable} disabled={state === 'working'} style={btnPrimary}>
          {state === 'working' ? 'Enabling…' : 'Enable notifications'}
        </button>
        <button onClick={dismiss} disabled={state === 'working'} style={btnGhost}>
          Not now
        </button>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

const btnPrimary = {
  padding: '10px 16px',
  borderRadius: 8,
  background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
  color: '#0a0a0b',
  border: 0,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

const btnGhost = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'transparent',
  color: INK_DIM,
  border: `1px solid ${BORDER}`,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
}
