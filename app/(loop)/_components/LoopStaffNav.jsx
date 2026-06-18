'use client'

import { usePathname } from 'next/navigation'

// Staff bottom nav for The Loop (Marines) — modeled on the Loop Network app
// shell Jacob prefers: a fixed bottom tab bar with icons + labels and a raised
// primary action in the middle (here, Door / scan — the key live action).
// Slim branded top bar already lives in the (loop) layout; this is the bottom.
//
// Only rendered for staff (isAdmin / isDriver computed server-side from the
// loop_admin / loop_driver code cookies and passed in) so riders never see it.
// Role-scoped: a driver gets Driver + Track; an admin gets Operations, Door,
// Track; someone holding both codes gets all of them.

const RED = '#e5484d'
const RED_HI = '#f2585d'
const INK_DIM = '#7c8088'

const ITEMS = [
  { href: '/marines/admin', label: 'Ops', kind: 'ops', role: 'admin', match: p => p.startsWith('/marines/admin') },
  { href: '/marines/security', label: 'Door', kind: 'door', role: 'admin', primary: true, match: p => p.startsWith('/marines/security') },
  { href: '/marines/driver', label: 'Driver', kind: 'driver', role: 'driver', match: p => p.startsWith('/marines/driver') },
  { href: '/marines/track', label: 'Track', kind: 'track', role: 'any', match: p => p.startsWith('/marines/track') },
]

export default function LoopStaffNav({ isAdmin = false, isDriver = false }) {
  const pathname = usePathname() || ''
  if (!isAdmin && !isDriver) return null

  const tabs = ITEMS.filter(t =>
    t.role === 'any' || (t.role === 'admin' && isAdmin) || (t.role === 'driver' && isDriver)
  )
  if (!tabs.length) return null

  return (
    <nav
      aria-label="The Loop staff"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: 'linear-gradient(180deg, rgba(20,24,28,0.85), rgba(20,24,28,0.97))',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        padding: '6px 8px 8px', maxWidth: 480, margin: '0 auto',
      }}>
        {tabs.map(t => {
          const active = t.match(pathname)
          if (t.primary) {
            return (
              <a key={t.href} href={t.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '6px 6px 4px', textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{
                  marginTop: -22, width: 50, height: 50, borderRadius: '50%',
                  display: 'grid', placeItems: 'center',
                  background: `linear-gradient(180deg, ${RED_HI}, ${RED})`,
                  color: '#fff', border: '4px solid #14181c',
                  boxShadow: '0 8px 22px rgba(229,72,77,0.45)',
                }}>
                  <StaffIcon kind={t.kind} />
                </span>
                <span style={{
                  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontWeight: 800, color: active ? RED_HI : INK_DIM,
                }}>{t.label}</span>
              </a>
            )
          }
          return (
            <a key={t.href} href={t.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 6px', textDecoration: 'none', position: 'relative',
              color: active ? RED_HI : INK_DIM, WebkitTapHighlightColor: 'transparent',
            }}>
              {active && (
                <span aria-hidden style={{
                  position: 'absolute', top: 0, width: 22, height: 3, borderRadius: 99,
                  background: `linear-gradient(90deg, ${RED}, ${RED_HI})`,
                  boxShadow: `0 0 12px ${RED}`,
                }} />
              )}
              <StaffIcon kind={t.kind} />
              <span style={{
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                fontWeight: 700, color: active ? RED_HI : INK_DIM,
              }}>{t.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}

function StaffIcon({ kind }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (kind === 'ops') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  }
  if (kind === 'door') {
    // QR / scan frame — the door scanner action.
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8V6a2 2 0 0 1 2-2h2" />
        <path d="M16 4h2a2 2 0 0 1 2 2v2" />
        <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
        <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
        <path d="M4 12h16" />
      </svg>
    )
  }
  if (kind === 'driver') {
    // Steering wheel.
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 9.5V3.2M9.8 13.6l-5.4 3M14.2 13.6l5.4 3" />
      </svg>
    )
  }
  if (kind === 'track') {
    return (
      <svg {...common}>
        <circle cx="12" cy="11" r="3" />
        <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z" />
      </svg>
    )
  }
  return null
}
