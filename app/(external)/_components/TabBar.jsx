'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK_DIM = '#7c7c84'

const BASE_TABS = [
  { href: '/', label: 'Home', kind: 'home', match: p => p === '/' },
  { href: '/events', label: 'Book', kind: 'book', match: p => p.startsWith('/events') || p.startsWith('/book') },
  { href: '/my-tickets', label: 'Tickets', kind: 'tickets', match: p => p.startsWith('/my-tickets') || p.startsWith('/tickets') },
  { href: '/bars', label: 'Bars', kind: 'bars', match: p => p.startsWith('/bars') },
]

const TRACK_TAB = { href: '/track', label: 'Track', kind: 'track', match: p => p.startsWith('/track') }

const HIDDEN_ON = [
  /^\/tickets\/[^/]+/,
  /^\/waiver\/[^/]+/,
  /^\/book\/[^/]+/,
]

export default function TabBar() {
  const pathname = usePathname() || '/'
  const [shuttleLive, setShuttleLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch('/api/shuttle/current', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setShuttleLive(!!json?.shuttle?.is_active)
      } catch {}
    }
    poll()
    const t = setInterval(poll, 20_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  if (HIDDEN_ON.some(re => re.test(pathname))) return null

  const tabs = shuttleLive
    ? [BASE_TABS[0], BASE_TABS[1], TRACK_TAB, BASE_TABS[2], BASE_TABS[3]]
    : BASE_TABS

  return (
    <nav
      aria-label="Brew Loop"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'linear-gradient(180deg, rgba(10,10,11,0.85), rgba(10,10,11,0.97))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          padding: '6px 8px 8px',
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        {tabs.map(t => {
          const active = t.match(pathname)
          return (
            <a
              key={t.href}
              href={t.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '8px 6px',
                color: active ? GOLD : INK_DIM,
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                position: 'relative',
              }}
            >
              <TabIcon kind={t.kind} active={active} />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: active ? GOLD_HI : INK_DIM,
                }}
              >
                {t.label}
              </span>
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: 24,
                    height: 3,
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${GOLD}, ${GOLD_HI})`,
                    boxShadow: `0 0 12px ${GOLD}`,
                  }}
                />
              )}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

function TabIcon({ kind, active }) {
  if (kind === 'home') return <HomeIcon active={active} />
  if (kind === 'book') return <TicketPlusIcon active={active} />
  if (kind === 'tickets') return <TicketIcon active={active} />
  if (kind === 'bars') return <MapIcon active={active} />
  if (kind === 'track') return <TrackIcon active={active} />
  return null
}

function HomeIcon({ active }) {
  if (active) {
    return (
      <span style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', filter: `drop-shadow(0 0 8px ${GOLD})` }}>
        <Image src="/brand/badge-gold.png" alt="" width={26} height={26} style={{ display: 'block' }} />
      </span>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  )
}

function TicketIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 5v14" strokeDasharray="2 2.5" />
    </svg>
  )
}

function TicketPlusIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M12 9v6" />
      <path d="M9 12h6" />
    </svg>
  )
}

function MapIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5L3 7v14l6-2 6 2 6-2V5l-6 2-6-2z" />
      <path d="M9 5v14" />
      <path d="M15 7v14" />
    </svg>
  )
}

function TrackIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="11" r="3" />
      <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
    </svg>
  )
}
