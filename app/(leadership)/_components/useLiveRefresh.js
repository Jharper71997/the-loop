'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Generalized auto-refresh for any server page that bakes in a `renderedAt`
// timestamp (via `await serverNow()`). Re-pulls the server component every
// `intervalMs` (paused while the tab is hidden) and ticks a 1s clock so a
// relative "updated Xs ago" label stays current. When fresh data lands the
// `renderedAt` prop changes and the label resets on its own.
//
// All Date.now() reads stay inside effects/intervals — never in render — so
// `react-hooks/purity` and `set-state-in-effect` stay happy.
export function useLiveRefresh(renderedAt, { intervalMs = 60_000 } = {}) {
  const router = useRouter()
  const [now, setNow] = useState(renderedAt)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, intervalMs)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, intervalMs])

  // router.refresh() re-runs the server component; the spinner is a brief
  // visual cue that clears itself shortly after (refresh is sub-second).
  function refresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1500)
  }

  return { now, refreshing, refresh }
}

export function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}
