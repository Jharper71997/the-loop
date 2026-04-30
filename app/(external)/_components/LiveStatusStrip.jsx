'use client'

import { useEffect, useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK_DIM = '#9c9ca3'
const LINE = 'rgba(255,255,255,0.06)'

// Small status row sitting under the top bar on every public page.
//   - Shuttle live → gold pulse + "Tap to track" → /track
//   - Otherwise   → muted "Next loop: <date> · <time>" (from server prop)
//   - Nothing to say → render null (so the page reads cleaner)
export default function LiveStatusStrip({ nextLoop }) {
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
    timer = setInterval(poll, 20_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const live = !!shuttle?.is_active
  if (!live && !nextLoop) return null

  if (live) {
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: `1px solid ${LINE}`,
        color: INK_DIM,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: GOLD }}>Next loop</span>
      <span style={{ color: INK_DIM }}>
        {formatLoopLabel(nextLoop)}
      </span>
    </div>
  )
}

function formatLoopLabel(loop) {
  if (!loop) return ''
  const date = formatDate(loop.eventDate)
  const time = formatTime(loop.pickupTime)
  if (date && time) return `${date} · ${time}`
  return date || time || ''
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
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
