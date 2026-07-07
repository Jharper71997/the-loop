'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'

// Live shuttle ribbon. Renders only when the shuttle is actively pinging,
// because everything else (next loop date, route, etc.) is already covered
// by the home hero, the Track tab, and the /events page.
export default function LiveStatusStrip() {
  const pathname = usePathname() || '/'
  const [shuttle, setShuttle] = useState(null)

  useEffect(() => {
    let cancelled = false
    let timer

    async function poll() {
      try {
        const res = await fetch('/api/shuttle/current', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setShuttle(json?.shuttle || null)
      } catch {}
    }

    poll()
    // Pause polling when the tab is hidden (locked phone / background); resume
    // and refresh on return. Keeps idle/backgrounded pages off the API.
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') poll()
    }, 30_000)
    const onVis = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const live = !!shuttle?.is_active
  if (!live) return null
  // No need to nag users who are already on /track.
  if (pathname.startsWith('/track')) return null

  return (
    <a
      href="/track"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: 'rgba(212,163,51,0.08)',
        borderBottom: `1px solid rgba(212,163,51,0.25)`,
        color: GOLD_HI,
        textDecoration: 'none',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      <PulseDot />
      <span>Shuttle live · tap to track</span>
      <span style={{ marginLeft: 'auto', color: GOLD }}>&rsaquo;</span>
    </a>
  )
}

function PulseDot() {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: GOLD,
        boxShadow: `0 0 0 0 ${GOLD}`,
        animation: 'jbl-pulse 1.6s ease-out infinite',
        flex: '0 0 auto',
      }}
    >
      <style>{`
        @keyframes jbl-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(212,163,51,0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(212,163,51,0); }
          100% { box-shadow: 0 0 0 0 rgba(212,163,51,0); }
        }
      `}</style>
    </span>
  )
}
