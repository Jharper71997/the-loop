'use client'

import { useEffect, useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

// Subscribes THIS device for driver push alerts (role='driver', no contact).
// New bookings then push here even if the page is closed. Hides once granted
// or where push isn't available.
export default function EnableDriverAlerts() {
  const [state, setState] = useState('idle') // idle | working | done | error | hidden | ios_install
  const [error, setError] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('brewloop_driveralerts_done') === '1') { setState('hidden'); return }

    // iPhone/iPad in a normal Safari tab can't do web push — Apple only allows it
    // once the site is added to the home screen and opened from that icon. In a
    // plain tab PushManager doesn't even exist, so detect iOS first and show the
    // how-to instead of silently hiding the whole box.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true
    if (isIOS && !isStandalone) { setState('ios_install'); return }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('hidden'); return }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) { setState('hidden'); return }
    if (Notification.permission === 'denied') { setState('hidden'); return }
  }, [])

  async function enable() {
    setState('working')
    setError(null)
    try {
      await navigator.serviceWorker.register('/sw.js')
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
        body: JSON.stringify({ role: 'driver', subscription: sub.toJSON(), user_agent: navigator.userAgent }),
      })
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`)
      sessionStorage.setItem('brewloop_driveralerts_done', '1')
      setState('done')
    } catch (err) {
      console.error('[driver alerts] enable failed', err)
      setError(err.message === 'notifications_blocked'
        ? 'Notifications are blocked in your browser settings.'
        : 'Could not enable alerts.')
      setState('error')
    }
  }

  if (state === 'hidden' || state === 'done') return null

  if (state === 'ios_install') {
    return (
      <div style={{
        background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px',
      }}>
        <div style={{ color: INK, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          📱 On an iPhone? Turn on alerts in 3 steps
        </div>
        <ol style={{ color: INK_DIM, fontSize: 12.5, margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Tap the <strong style={{ color: INK }}>Share</strong> button (the square with an up-arrow) at the bottom of Safari.</li>
          <li>Scroll down and tap <strong style={{ color: INK }}>Add to Home Screen</strong>, then <strong style={{ color: INK }}>Add</strong>.</li>
          <li>Open <strong style={{ color: INK }}>Brew Loop</strong> from the new icon, come back here, and tap <strong style={{ color: GOLD }}>Turn on</strong>.</li>
        </ol>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 9 }}>
          Apple only allows alerts from the home-screen icon, not a normal Safari tab. On Android it just works — tap Turn on.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 10,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: INK, fontSize: 13, fontWeight: 600 }}>Get alerted to new bookings</div>
        <div style={{ color: INK_DIM, fontSize: 12 }}>
          {error || 'Push this device when a ticket is purchased, even if the app is closed.'}
        </div>
      </div>
      <button onClick={enable} disabled={state === 'working'} style={{
        background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b',
        border: 0, padding: '9px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13,
        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {state === 'working' ? 'Enabling…' : 'Turn on'}
      </button>
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
