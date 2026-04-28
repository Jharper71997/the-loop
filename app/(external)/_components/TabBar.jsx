'use client'

import { usePathname } from 'next/navigation'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#7c7c84'

const TABS = [
  { href: '/', label: 'Home', icon: HomeIcon, match: p => p === '/' },
  { href: '/events', label: 'Book', icon: TicketPlusIcon, match: p => p.startsWith('/events') || p.startsWith('/book') },
  { href: '/my-tickets', label: 'Tickets', icon: TicketIcon, match: p => p.startsWith('/my-tickets') || p.startsWith('/tickets') },
  { href: '/bars', label: 'Bars', icon: MapIcon, match: p => p.startsWith('/bars') },
]

// Pages that should NOT show the tab bar (boarding pass, individual ticket
// view, the inline waiver page). These are full-screen rider moments.
const HIDDEN_ON = [
  /^\/tickets\/[^/]+/,
  /^\/waiver\/[^/]+/,
  /^\/book\/[^/]+/,
]

export default function TabBar() {
  const pathname = usePathname() || '/'
  if (HIDDEN_ON.some(re => re.test(pathname))) return null

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
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          padding: '6px 8px 8px',
          maxWidth: 520,
          margin: '0 auto',
        }}
      >
        {TABS.map(t => {
          const active = t.match(pathname)
          const Icon = t.icon
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
              <Icon active={active} />
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

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
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
