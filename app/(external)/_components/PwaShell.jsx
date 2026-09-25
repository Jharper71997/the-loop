'use client'

import { useEffect } from 'react'

// Client-side PWA glue: register the service worker so iOS/Android still treat
// the site as installable from the browser's own menu.
//
// The "Install / Add to Home Screen" banner that used to live here is gone
// (Jacob, 2026-09-25: "its annoying"). It sat fixed over the bottom of every
// app page, including ones with Pay buttons. Don't bring it back.
export default function PwaShell() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
