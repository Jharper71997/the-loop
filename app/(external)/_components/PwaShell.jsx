'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { brandFor } from '@/lib/businessConfig'
import { useRiderBusiness } from '@/lib/useBusiness'
import { isMarketingPath } from './site/nav'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#0a0a0b'

// Client-side PWA glue:
//  1. Register the service worker so iOS/Android treat us as installable.
//  2. Listen for `beforeinstallprompt` (Chromium) and surface a small bottom
//     prompt the user can tap to install.
//  3. iOS Safari has no install prompt event — instead we show a one-time
//     hint card the first session.
export default function PwaShell() {
  const kind = useRiderBusiness()
  const pathname = usePathname() || '/'
  const cfg = brandFor(kind)
  const dismissKey = `${kind}-install-dismissed`
  const [chromiumPrompt, setChromiumPrompt] = useState(null)
  const [iosHint, setIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const seen = (() => {
      try { return localStorage.getItem(dismissKey) === '1' } catch { return false }
    })()
    setDismissed(seen)

    function onPrompt(e) {
      e.preventDefault()
      setChromiumPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS Safari detection: standalone? hint not needed. Otherwise show.
    const ua = navigator.userAgent || ''
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone
    if (isIos && !isStandalone && !seen) {
      setIosHint(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissKey])

  function dismiss() {
    setDismissed(true)
    setIosHint(false)
    setChromiumPrompt(null)
    try { localStorage.setItem(dismissKey, '1') } catch {}
  }

  async function install() {
    if (!chromiumPrompt) return
    chromiumPrompt.prompt()
    try { await chromiumPrompt.userChoice } catch {}
    setChromiumPrompt(null)
    dismiss()
  }

  // Never on the Brew website pages — the service worker still registers above,
  // but a first-time visitor reading the homepage shouldn't be pitched an app
  // install before they've booked anything. App pages still prompt.
  if (kind === 'brew' && isMarketingPath(pathname)) return null
  if (dismissed) return null
  if (!chromiumPrompt && !iosHint) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(82px + env(safe-area-inset-bottom))',
        zIndex: 60,
        padding: '12px 14px',
        borderRadius: 14,
        background: 'rgba(15,15,18,0.96)',
        border: `1px solid ${GOLD}`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Install {cfg.shortBrand}
        </div>
        <div style={{ color: '#f5f5f7', fontSize: 13, marginTop: 2 }}>
          {chromiumPrompt
            ? 'One-tap add to your home screen.'
            : 'Tap Share, then "Add to Home Screen" to keep your ticket one tap away.'}
        </div>
      </div>
      {chromiumPrompt && (
        <button
          type="button"
          onClick={install}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
            color: INK,
            border: 0,
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          padding: 8,
          background: 'transparent',
          border: 0,
          color: '#9c9ca3',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
