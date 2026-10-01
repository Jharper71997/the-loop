'use client'

import { useEffect } from 'react'

// Registers the service worker (push notifications need it). No install
// prompt anywhere: Jacob 2026-10-01, "get rid of one tap add to your home
// screen on all fronts".
export default function PwaShell() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
