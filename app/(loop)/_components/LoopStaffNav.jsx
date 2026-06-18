'use client'

import { usePathname } from 'next/navigation'

// Staff terminal top nav for The Loop (Marines) — the RED 1:1 mirror of the
// Brew admin NavBar (app/(admin)/_components/NavBar.js): Orbitron "THE LOOP"
// wordmark + JetBrains-Mono tab pills (active = red gradient + glow), a lock
// button on the right. Replaces the rider header on staff routes; riders never
// see it (isAdmin/isDriver computed server-side from the code cookies).
// Role-scoped: a driver gets Driver + Track; an admin gets Ops, Door, Track.

const RED = '#e5484d'
const RED_HI = '#f2585d'
const INK = '#eef1f3'
const INK_DIM = '#9aa3ab'
const LINE = 'rgba(255,255,255,0.12)'
const DISPLAY = "'Orbitron', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

const ITEMS = [
  { href: '/marines/admin', label: 'Ops', role: 'admin', match: p => p.startsWith('/marines/admin') },
  { href: '/marines/security', label: 'Door', role: 'admin', match: p => p.startsWith('/marines/security') },
  { href: '/marines/driver', label: 'Driver', role: 'driver', match: p => p.startsWith('/marines/driver') },
  { href: '/marines/track', label: 'Track', role: 'any', match: p => p.startsWith('/marines/track') },
]

export default function LoopStaffNav({ isAdmin = false, isDriver = false }) {
  const pathname = usePathname() || ''
  if (!isAdmin && !isDriver) return null

  const tabs = ITEMS.filter(t =>
    t.role === 'any' || (t.role === 'admin' && isAdmin) || (t.role === 'driver' && isDriver)
  )

  async function lock() {
    try {
      const calls = []
      if (isAdmin) calls.push(fetch('/api/loop-admin', { method: 'DELETE' }))
      if (isDriver) calls.push(fetch('/api/loop-driver', { method: 'DELETE' }))
      await Promise.all(calls)
    } catch {}
    window.location.href = '/marines'
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'linear-gradient(180deg, #161b20, #10141a)',
      borderBottom: `1px solid ${LINE}`,
      boxShadow: '0 1px 0 rgba(229,72,77,0.30), 0 8px 24px rgba(0,0,0,0.5)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
      }}>
        <a href="/marines" style={{
          color: RED, fontFamily: DISPLAY, fontWeight: 900, fontSize: 14,
          letterSpacing: '0.22em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          textDecoration: 'none', textShadow: '0 0 14px rgba(229,72,77,0.5)',
        }}>
          THE&nbsp;LOOP
        </a>

        <span aria-hidden style={{ width: 1, height: 18, background: LINE, flexShrink: 0 }} />

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }}>
          {tabs.map(t => {
            const on = t.match(pathname)
            return (
              <a key={t.href} href={t.href} style={{
                flexShrink: 0, textDecoration: 'none', whiteSpace: 'nowrap',
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                padding: '5px 11px', borderRadius: 4,
                color: on ? '#fff' : INK_DIM,
                background: on ? `linear-gradient(180deg, ${RED_HI}, ${RED})` : 'transparent',
                border: on ? '1px solid rgba(0,0,0,0.4)' : '1px solid transparent',
                boxShadow: on ? '0 0 20px rgba(229,72,77,0.45)' : 'none',
              }}>
                {t.label}
              </a>
            )
          })}
        </div>

        <button onClick={lock} aria-label="Lock" style={{
          marginLeft: 'auto', flexShrink: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          color: INK_DIM, fontFamily: MONO, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px',
        }}>
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>⏻</span>
          <span style={{ display: 'none' }} className="loop-lock-label">Lock</span>
        </button>
      </div>
    </nav>
  )
}
