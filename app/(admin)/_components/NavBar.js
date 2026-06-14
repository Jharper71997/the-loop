'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isLeadership, isSecurity, isDriver } from '@/lib/roles'

const LINKS = [
  { href: '/admin', label: 'Schedule' },
  { href: '/admin/groups', label: 'Loops' },
  { href: '/admin/schedule', label: 'Crew' },
  { href: '/admin/contacts', label: 'Contacts' },
  { href: '/admin/security', label: 'Security', security: true },
  { href: '/admin/driver', label: 'Driver', driver: true },
]

function visibleLinks({ isLeader, isSec, isDrv }) {
  return LINKS
    .filter(l => isLeader || !l.leadership)
    .filter(l => isSec || !l.security)
    .filter(l => isDrv || !l.driver)
}

function linkActive(pathname, href) {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(href + '/')
}

export default function NavBar() {
  const pathname = usePathname()
  const [email, setEmail] = useState(null)
  const isLeader = isLeadership(email)
  const isSec = isSecurity(email)
  const isDrv = isDriver(email)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || null))
  }, [])

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    let cancelled = false
    const q = search.trim()
    const t = setTimeout(async () => {
      if (!q) { if (!cancelled) setResults([]); return }
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, email')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8)
      if (!cancelled) setResults(data || [])
    }, q ? 200 : 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])

  if (pathname === '/login') {
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  const links = visibleLinks({ isLeader, isSec, isDrv })

  return (
    <nav className="admin-nav" style={{
      background: 'linear-gradient(180deg, #0d0d10, #0a0a0b)',
      borderBottom: '1px solid #2a2a31',
      boxShadow: '0 1px 0 rgba(212,163,51,0.25), 0 8px 24px rgba(0,0,0,0.5)',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div className="admin-nav-top" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
      }}>
        <a href="/admin" style={{
          color: '#d4a333',
          fontFamily: "'Orbitron', system-ui, sans-serif",
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

        <span className="admin-nav-divider" style={{
          width: 1, height: 18, background: '#2a2a31', flexShrink: 0,
        }} />

        {/* Tabs — inline on desktop, hidden on mobile (moved into hamburger menu) */}
        <div className="admin-nav-tabs-desktop" style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto' }}>
          <Tabs pathname={pathname} links={links} />
        </div>

        <div ref={boxRef} className="admin-nav-right" style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="admin-nav-search"
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="> search riders"
            style={{
              background: 'linear-gradient(180deg, #121216, #0d0d10)',
              border: '1px solid #2a2a31',
              color: '#e8e8ea',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              letterSpacing: '0.04em',
              width: 190,
              margin: 0,
            }}
          />
          {open && results.length > 0 && (
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
              {results.map(r => (
                <a
                  key={r.id}
                  href={`/admin/contacts?focus=${r.id}`}
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
                  <div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                  <div style={{
                    fontSize: 11,
                    color: '#9c9ca3',
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    letterSpacing: '0.04em',
                  }}>{r.phone || r.email}</div>
                </a>
              ))}
            </div>
          )}

          {email && (
            <span className="admin-nav-email" style={{
              color: '#d4a333',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
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
              {email.split('@')[0]}
            </span>
          )}
          <button className="admin-nav-signout-desktop" onClick={signOut} style={{
            background: 'none',
            color: '#6f6f76',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '8px 10px',
            cursor: 'pointer',
            minHeight: 36,
          }}>
            Sign&nbsp;out
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="admin-hamburger"
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
        <AdminMobileMenu
          pathname={pathname}
          links={links}
          email={email}
          search={search}
          setSearch={setSearch}
          results={results}
          onClose={() => setMenuOpen(false)}
          onSignOut={signOut}
        />
      )}

      <style>{`
        @media (max-width: 767px) {
          .admin-nav-divider { display: none; }
          .admin-nav-tabs-desktop { display: none !important; }
          .admin-nav-search { display: none !important; }
          .admin-nav-email { display: none !important; }
          .admin-nav-signout-desktop { display: none !important; }
          .admin-hamburger { display: inline-flex !important; }
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

function AdminMobileMenu({ pathname, links, email, search, setSearch, results, onClose, onSignOut }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        top: 'calc(env(safe-area-inset-top) + 61px)',
        background: '#0a0a0b',
        zIndex: 25,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '14px 0 calc(40px + env(safe-area-inset-bottom))',
      }}
    >
      {/* Rider search inside the menu — full width, usable on a phone */}
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
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
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
            {results.map(r => (
              <a
                key={r.id}
                href={`/admin/contacts?focus=${r.id}`}
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
                <div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                <div style={{
                  fontSize: 12,
                  color: '#9c9ca3',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}>{r.phone || r.email}</div>
              </a>
            ))}
          </div>
        )}
      </div>

      {links.map(link => {
        const active = linkActive(pathname, link.href)
        return (
          <a
            key={link.href}
            href={link.href}
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
              fontFamily: "'Orbitron', system-ui, sans-serif",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              borderBottom: '1px solid #16161c',
            }}
          >
            {link.label}
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
        {email && (
          <span style={{
            color: '#6f6f76',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 12,
            letterSpacing: '0.04em',
          }}>
            {email}
          </span>
        )}
        <button onClick={onSignOut} style={{
          background: 'none',
          color: '#9c9ca3',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          padding: '10px 16px',
          border: '1px solid #2a2a31',
          borderRadius: 8,
          cursor: 'pointer',
        }}>
          Sign out
        </button>
      </div>
    </div>
  )
}

function Tabs({ pathname, links }) {
  return (
    <>
      {links.map(l => {
        const active = linkActive(pathname, l.href)
        return (
          <a
            key={l.href}
            href={l.href}
            style={{
              color: active ? '#0a0a0b' : '#c8c8cc',
              background: active ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : 'transparent',
              textDecoration: 'none',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
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
            {l.label}
          </a>
        )
      })}
    </>
  )
}
