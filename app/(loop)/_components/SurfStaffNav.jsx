'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Staff terminal top nav for Surf City Loop — structurally mirrors the Marines
// LoopStaffNav (gold Orbitron wordmark, mono tab pills, role chip, Lock,
// hamburger menu on mobile) but trimmed: no rider-search dropdown (Surf riders
// are plain contacts, not ID-verification rows). Tabs route to /surfcity/*,
// Lock clears the Surf code cookies. Riders never see it (isAdmin/isDriver are
// computed server-side from the surf_admin / surf_driver cookies).

const DISPLAY = "'Orbitron', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

const ITEMS = [
  { href: '/surfcity/admin', label: 'Ops', role: 'admin', match: p => p.startsWith('/surfcity/admin') && !p.startsWith('/surfcity/admin/builder') },
  { href: '/surfcity/admin/builder', label: 'Builder', role: 'admin', match: p => p.startsWith('/surfcity/admin/builder') },
  { href: '/surfcity/security', label: 'Door', role: 'admin', match: p => p.startsWith('/surfcity/security') },
  { href: '/surfcity/driver', label: 'Driver', role: 'driver', match: p => p.startsWith('/surfcity/driver') },
  { href: '/surfcity/track', label: 'Track', role: 'any', match: p => p.startsWith('/surfcity/track') },
]

export default function SurfStaffNav({ isAdmin = false, isDriver = false }) {
  const pathname = usePathname() || ''
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])

  if (!isAdmin && !isDriver) return null

  const tabs = ITEMS.filter(t =>
    t.role === 'any' || (t.role === 'admin' && isAdmin) || (t.role === 'driver' && isDriver)
  )

  async function lock() {
    try {
      const calls = []
      if (isAdmin) calls.push(fetch('/api/surf-admin', { method: 'DELETE' }))
      if (isDriver) calls.push(fetch('/api/surf-driver', { method: 'DELETE' }))
      await Promise.all(calls)
    } catch {}
    window.location.href = '/surfcity'
  }

  const role = isAdmin ? 'Admin' : 'Driver'

  return (
    <nav className="surf-nav" style={{
      background: 'linear-gradient(180deg, #0d0d10, #0a0a0b)',
      borderBottom: '1px solid #2a2a31',
      boxShadow: '0 1px 0 rgba(212,163,51,0.25), 0 8px 24px rgba(0,0,0,0.5)',
      position: 'sticky', top: 0, zIndex: 40, paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
      }}>
        <a href="/surfcity" style={{
          color: '#d4a333', fontFamily: DISPLAY, fontWeight: 900, fontSize: '14px',
          whiteSpace: 'nowrap', textDecoration: 'none', letterSpacing: '0.22em',
          textTransform: 'uppercase', textShadow: '0 0 14px rgba(212,163,51,0.45)',
        }}>
          SURF&nbsp;CITY
        </a>

        <span className="surf-nav-divider" style={{ width: 1, height: 18, background: '#2a2a31', flexShrink: 0 }} />

        <div className="surf-nav-tabs-desktop" style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto' }}>
          <Tabs pathname={pathname} tabs={tabs} />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="surf-nav-role" style={{
            color: '#d4a333', fontFamily: MONO, fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4a333', boxShadow: '0 0 8px #d4a333' }} />
            {role}
          </span>

          <button className="surf-nav-lock-desktop" onClick={lock} aria-label="Lock" style={{
            background: 'none', border: 'none', color: '#6f6f76', fontFamily: MONO, fontSize: '10px',
            fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '8px 10px',
            cursor: 'pointer', minHeight: 36, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>⏻</span>
            Lock
          </button>

          <button
            className="surf-hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'none', background: 'linear-gradient(180deg, #121216, #0d0d10)',
              border: '1px solid #2a2a31', borderRadius: 8, padding: 0, width: 40, height: 40,
              cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, top: 'calc(env(safe-area-inset-top) + 61px)',
          background: '#0a0a0b', zIndex: 35, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: '14px 0 calc(40px + env(safe-area-inset-bottom))',
        }}>
          {tabs.map(t => {
            const active = t.match(pathname)
            return (
              <a key={t.href} href={t.href} onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 22px', paddingLeft: 'max(22px, env(safe-area-inset-left))',
                paddingRight: 'max(22px, env(safe-area-inset-right))', textDecoration: 'none',
                color: active ? '#d4a333' : '#e8e8ea', fontFamily: DISPLAY, fontSize: 15,
                fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                borderBottom: '1px solid #16161c',
              }}>
                {t.label}
                {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d4a333', boxShadow: '0 0 8px rgba(212,163,51,0.6)' }} />}
              </a>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px' }}>
            <span style={{ color: '#6f6f76', fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{role}</span>
            <button onClick={lock} style={{
              background: 'none', color: '#9c9ca3', fontFamily: MONO, fontSize: 12, fontWeight: 600,
              letterSpacing: '0.18em', textTransform: 'uppercase', padding: '10px 16px',
              border: '1px solid #2a2a31', borderRadius: 8, cursor: 'pointer',
            }}>Lock</button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 767px) {
          .surf-nav-divider { display: none; }
          .surf-nav-tabs-desktop { display: none !important; }
          .surf-nav-role { display: none !important; }
          .surf-nav-lock-desktop { display: none !important; }
          .surf-hamburger { display: inline-flex !important; }
        }
      `}</style>
    </nav>
  )
}

function HamburgerIcon({ open }) {
  const bar = {
    position: 'absolute', left: 9, width: 18, height: 2, background: '#d4a333',
    borderRadius: 2, boxShadow: '0 0 6px rgba(212,163,51,0.5)',
    transition: 'transform 0.18s ease, opacity 0.18s ease',
  }
  return (
    <span style={{ position: 'relative', width: 18, height: 14, display: 'inline-block' }}>
      <span style={{ ...bar, top: open ? 6 : 0, transform: open ? 'rotate(45deg)' : 'none' }} />
      <span style={{ ...bar, top: 6, opacity: open ? 0 : 1 }} />
      <span style={{ ...bar, top: open ? 6 : 12, transform: open ? 'rotate(-45deg)' : 'none' }} />
    </span>
  )
}

function Tabs({ pathname, tabs }) {
  return (
    <>
      {tabs.map(t => {
        const active = t.match(pathname)
        return (
          <a key={t.href} href={t.href} style={{
            color: active ? '#0a0a0b' : '#c8c8cc',
            background: active ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : 'transparent',
            textDecoration: 'none', fontFamily: MONO, fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 4,
            border: active ? '1px solid rgba(0,0,0,0.4)' : '1px solid transparent',
            boxShadow: active ? '0 0 20px rgba(212,163,51,0.45)' : 'none', whiteSpace: 'nowrap',
            transition: 'color 0.15s, background 0.15s', display: 'inline-flex', alignItems: 'center', flexShrink: 0,
          }}>
            {t.label}
          </a>
        )
      })}
    </>
  )
}
