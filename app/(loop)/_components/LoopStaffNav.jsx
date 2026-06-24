'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// Staff terminal top nav for The Loop (Marines) — a 1:1 structural mirror of the
// Brew admin NavBar (app/(admin)/_components/NavBar.js): a gold Orbitron
// "THE LOOP" wordmark, a vertical divider, JetBrains-Mono tab pills (active =
// gold gradient + DARK text + glow), a rider search with a live dropdown on the
// right, a role status chip, and the SAME mobile behavior as Brew — desktop tabs
// hide under a hamburger that opens a full-screen mobile menu.
//
// Marines-specific pieces are preserved: the tabs stay its own routes with role
// gating (admin sees Ops/Door/Track, driver sees Driver/Track); the search hits
// the Marines endpoint /api/loop-admin/verifications and deep-links to
// /marines/admin?tab=riders&q=…; the right-side action stays the code-gate Lock
// button (DELETE /api/loop-admin and/or /api/loop-driver, then go to /marines) —
// NOT a Supabase signOut. Riders never see it (isAdmin/isDriver are computed
// server-side from the code cookies).

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
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const cacheRef = useRef(null)
  const boxRef = useRef(null)

  // Close the dropdown when clicking outside the search box.
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  // Lazy-load the rider list once, then filter client-side as the user types.
  useEffect(() => {
    let cancelled = false
    const q = search.trim().toLowerCase()
    if (!q) { setResults([]); return }
    ;(async () => {
      let list = cacheRef.current
      if (!list) {
        try {
          const res = await fetch('/api/loop-admin/verifications')
          const json = await res.json().catch(() => ({}))
          list = (json.verifications || []).filter(r => r.status === 'approved' || r.status === 'pending')
        } catch { list = [] }
        cacheRef.current = list
      }
      if (cancelled) return
      setResults(
        list
          .filter(r => `${r.full_name} ${r.email} ${r.phone} ${r.branch} ${r.unit} ${r.rank}`.toLowerCase().includes(q))
          .slice(0, 8)
      )
    })()
    return () => { cancelled = true }
  }, [search])

  // Lock the page scroll while the full-screen mobile menu is open.
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
      if (isAdmin) calls.push(fetch('/api/loop-admin', { method: 'DELETE' }))
      if (isDriver) calls.push(fetch('/api/loop-driver', { method: 'DELETE' }))
      await Promise.all(calls)
    } catch {}
    window.location.href = '/marines'
  }

  function go() {
    const term = search.trim()
    if (!term) return
    window.location.href = `/marines/admin?tab=riders&q=${encodeURIComponent(term)}`
  }

  const role = isAdmin ? 'Admin' : 'Driver'

  return (
    <nav className="loop-nav" style={{
      background: 'linear-gradient(180deg, #0d0d10, #0a0a0b)',
      borderBottom: '1px solid #2a2a31',
      boxShadow: '0 1px 0 rgba(212,163,51,0.25), 0 8px 24px rgba(0,0,0,0.5)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div className="loop-nav-top" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
      }}>
        <a href="/marines" style={{
          color: '#d4a333',
          fontFamily: DISPLAY,
          fontWeight: 900,
          fontSize: '14px',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          textShadow: '0 0 14px rgba(212,163,51,0.45)',
        }}>
          THE&nbsp;LOOP
        </a>

        <span className="loop-nav-divider" style={{
          width: 1, height: 18, background: '#2a2a31', flexShrink: 0,
        }} />

        {/* Tabs — inline on desktop, hidden on mobile (moved into hamburger menu) */}
        <div className="loop-nav-tabs-desktop" style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto' }}>
          <Tabs pathname={pathname} tabs={tabs} />
        </div>

        <div ref={boxRef} className="loop-nav-right" style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <input
              className="loop-nav-search"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onKeyDown={e => { if (e.key === 'Enter') { setOpen(false); go() } }}
              placeholder="> search riders"
              style={{
                background: 'linear-gradient(180deg, #121216, #0d0d10)',
                border: '1px solid #2a2a31',
                color: '#e8e8ea',
                fontFamily: MONO,
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                letterSpacing: '0.04em',
                width: 190,
                margin: 0,
              }}
            />
          )}
          {isAdmin && open && results.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              background: 'linear-gradient(180deg, #121216, #0d0d10)',
              border: '1px solid #2a2a31',
              borderRadius: 8,
              padding: 4,
              minWidth: 240,
              boxShadow: '0 0 0 1px rgba(212,163,51,0.08), 0 12px 28px rgba(0,0,0,0.6)',
              zIndex: 20,
            }}>
              {results.map(r => {
                const meta = [r.rank, r.unit, r.branch].filter(Boolean).join(' · ')
                return (
                  <a
                    key={r.id}
                    href={`/marines/admin?tab=riders&q=${encodeURIComponent(r.full_name || r.email || r.phone || '')}`}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'block',
                      padding: '8px 10px',
                      borderRadius: 4,
                      textDecoration: 'none',
                      color: '#e8e8ea',
                      fontSize: 13,
                      borderLeft: '2px solid transparent',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(212,163,51,0.08)'
                      e.currentTarget.style.borderLeftColor = '#d4a333'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderLeftColor = 'transparent'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.full_name || '(no name)'}</div>
                    <div style={{
                      fontSize: 11,
                      color: '#9c9ca3',
                      fontFamily: MONO,
                      letterSpacing: '0.04em',
                    }}>{meta || r.email || r.phone || '—'}</div>
                  </a>
                )
              })}
            </div>
          )}

          <span className="loop-nav-role" style={{
            color: '#d4a333',
            fontFamily: MONO,
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#d4a333', boxShadow: '0 0 8px #d4a333',
            }} />
            {role}
          </span>

          <button className="loop-nav-lock-desktop" onClick={lock} aria-label="Lock" style={{
            background: 'none',
            border: 'none',
            color: '#6f6f76',
            fontFamily: MONO,
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '8px 10px',
            cursor: 'pointer',
            minHeight: 36,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>⏻</span>
            Lock
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="loop-hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'none',
              background: 'linear-gradient(180deg, #121216, #0d0d10)',
              border: '1px solid #2a2a31',
              borderRadius: 8,
              padding: 0,
              width: 40,
              height: 40,
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {/* Mobile full-screen menu */}
      {menuOpen && (
        <LoopMobileMenu
          pathname={pathname}
          tabs={tabs}
          role={role}
          isAdmin={isAdmin}
          search={search}
          setSearch={setSearch}
          results={results}
          onClose={() => setMenuOpen(false)}
          onLock={lock}
        />
      )}

      <style>{`
        @media (max-width: 767px) {
          .loop-nav-divider { display: none; }
          .loop-nav-tabs-desktop { display: none !important; }
          .loop-nav-search { display: none !important; }
          .loop-nav-role { display: none !important; }
          .loop-nav-lock-desktop { display: none !important; }
          .loop-hamburger { display: inline-flex !important; }
        }
      `}</style>
    </nav>
  )
}

function HamburgerIcon({ open }) {
  const bar = {
    position: 'absolute',
    left: 9,
    width: 18,
    height: 2,
    background: '#d4a333',
    borderRadius: 2,
    boxShadow: '0 0 6px rgba(212,163,51,0.5)',
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

function LoopMobileMenu({ pathname, tabs, role, isAdmin, search, setSearch, results, onClose, onLock }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        top: 'calc(env(safe-area-inset-top) + 61px)',
        background: '#0a0a0b',
        zIndex: 35,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '14px 0 calc(40px + env(safe-area-inset-bottom))',
      }}
    >
      {/* Rider search inside the menu — full width, usable on a phone (admin only) */}
      {isAdmin && (
        <div style={{
          padding: '0 18px 14px',
          paddingLeft: 'max(18px, env(safe-area-inset-left))',
          paddingRight: 'max(18px, env(safe-area-inset-right))',
          borderBottom: '1px solid #16161c',
          marginBottom: 6,
        }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="> search riders"
            style={{
              background: 'linear-gradient(180deg, #121216, #0d0d10)',
              border: '1px solid #2a2a31',
              color: '#e8e8ea',
              fontFamily: MONO,
              padding: '12px 14px',
              borderRadius: 8,
              fontSize: 16,
              letterSpacing: '0.04em',
              width: '100%',
              margin: 0,
            }}
          />
          {results.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {results.map(r => {
                const meta = [r.rank, r.unit, r.branch].filter(Boolean).join(' · ')
                return (
                  <a
                    key={r.id}
                    href={`/marines/admin?tab=riders&q=${encodeURIComponent(r.full_name || r.email || r.phone || '')}`}
                    onClick={onClose}
                    style={{
                      display: 'block',
                      padding: '10px 12px',
                      borderRadius: 6,
                      textDecoration: 'none',
                      color: '#e8e8ea',
                      fontSize: 14,
                      borderLeft: '2px solid #2a2a31',
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.full_name || '(no name)'}</div>
                    <div style={{
                      fontSize: 12,
                      color: '#9c9ca3',
                      fontFamily: MONO,
                    }}>{meta || r.email || r.phone || '—'}</div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tabs.map(t => {
        const active = t.match(pathname)
        return (
          <a
            key={t.href}
            href={t.href}
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '15px 22px',
              paddingLeft: 'max(22px, env(safe-area-inset-left))',
              paddingRight: 'max(22px, env(safe-area-inset-right))',
              textDecoration: 'none',
              color: active ? '#d4a333' : '#e8e8ea',
              fontFamily: DISPLAY,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              borderBottom: '1px solid #16161c',
            }}
          >
            {t.label}
            {active && <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#d4a333', boxShadow: '0 0 8px rgba(212,163,51,0.6)',
            }} />}
          </a>
        )
      })}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '22px',
        paddingLeft: 'max(22px, env(safe-area-inset-left))',
        paddingRight: 'max(22px, env(safe-area-inset-right))',
      }}>
        <span style={{
          color: '#6f6f76',
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          {role}
        </span>
        <button onClick={onLock} style={{
          background: 'none',
          color: '#9c9ca3',
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          padding: '10px 16px',
          border: '1px solid #2a2a31',
          borderRadius: 8,
          cursor: 'pointer',
        }}>
          Lock
        </button>
      </div>
    </div>
  )
}

function Tabs({ pathname, tabs }) {
  return (
    <>
      {tabs.map(t => {
        const active = t.match(pathname)
        return (
          <a
            key={t.href}
            href={t.href}
            style={{
              color: active ? '#0a0a0b' : '#c8c8cc',
              background: active ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : 'transparent',
              textDecoration: 'none',
              fontFamily: MONO,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: 4,
              border: active ? '1px solid rgba(0,0,0,0.4)' : '1px solid transparent',
              boxShadow: active ? '0 0 20px rgba(212,163,51,0.45)' : 'none',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, background 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {t.label}
          </a>
        )
      })}
    </>
  )
}
