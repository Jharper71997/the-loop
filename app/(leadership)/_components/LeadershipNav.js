'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Calmer redesign — system sans, mono only on numbers, subtler gold accents.
// Desktop keeps the tab bar + a contextual sub-row. Mobile collapses
// everything into a single hamburger menu so nothing scrolls off-screen.

const INCOME_SUB_LINKS = [
  { href: '/leadership/income',    label: 'Overview' },
  { href: '/leadership/expenses',  label: 'Expenses' },
  { href: '/leadership/cash',      label: 'Cash' },
  { href: '/leadership/sponsors',  label: 'Sponsors' },
  { href: '/leadership/bars',      label: 'Bars' },
  { href: '/leadership/ridership', label: 'Ridership' },
  { href: '/leadership/passes',    label: 'Loop Pass' },
]

const DRIVERS_SUB_LINKS = [
  { href: '/leadership/drivers',           label: 'Roster' },
  { href: '/leadership/drivers/route-log', label: 'Route log' },
]

const INCOME_GROUP = INCOME_SUB_LINKS.map(l => l.href)
const DRIVERS_GROUP = DRIVERS_SUB_LINKS.map(l => l.href)

const TOP_LINKS = [
  { href: '/leadership',             label: 'Scoreboard' },
  { href: '/leadership/income',      label: 'Income', groupPaths: INCOME_GROUP, children: INCOME_SUB_LINKS },
  { href: '/leadership/leaderboard', label: 'Leaderboard' },
  { href: '/leadership/referrals',   label: 'Referrals' },
  { href: '/leadership/loops',       label: 'Loops' },
  { href: '/leadership/drivers',     label: 'Drivers', groupPaths: DRIVERS_GROUP, children: DRIVERS_SUB_LINKS },
  { href: '/leadership/schedule',    label: 'Schedule' },
  { href: '/leadership/attribution', label: 'Attribution' },
  { href: '/leadership/alerts',      label: 'Alerts' },
  { href: '/leadership/automations', label: 'Automations' },
]

const SUBNAV_GROUPS = [
  { paths: INCOME_GROUP,  links: INCOME_SUB_LINKS },
  { paths: DRIVERS_GROUP, links: DRIVERS_SUB_LINKS },
]

function matchesPath(pathname, href) {
  return pathname === href || pathname.startsWith(href + '/')
}

function isActive(pathname, link) {
  if (link.groupPaths) {
    return link.groupPaths.some(p => matchesPath(pathname, p))
  }
  if (link.href === '/leadership') return pathname === '/leadership'
  return matchesPath(pathname, link.href)
}

function activeSubnavLinks(pathname) {
  for (const g of SUBNAV_GROUPS) {
    if (g.paths.some(p => matchesPath(pathname, p))) return g.links
  }
  return null
}

export default function LeadershipNav() {
  const pathname = usePathname()
  const [email, setEmail] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const subLinks = activeSubnavLinks(pathname)
  const showSubNav = subLinks != null

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || null))
  }, [])

  // Lock background scroll while the full-screen menu is open.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <nav style={{
      background: '#0d0d10',
      borderBottom: '1px solid #2a2a31',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '12px 18px',
        paddingLeft: 'max(18px, env(safe-area-inset-left))',
        paddingRight: 'max(18px, env(safe-area-inset-right))',
      }}>
        <a href="/leadership" style={{
          color: '#d4a333',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontWeight: 700,
          fontSize: '14px',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
          letterSpacing: '0.04em',
        }}>
          Leadership
        </a>

        <span className="leadership-nav-divider" style={{
          width: 1, height: 16, background: '#2a2a31', flexShrink: 0,
        }} />

        <div className="leadership-nav-tabs-desktop" style={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          overflowX: 'auto',
        }}>
          <Tabs pathname={pathname} links={TOP_LINKS} />
        </div>

        <div className="leadership-nav-right" style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {email && (
            <span className="leadership-nav-email" style={{
              color: '#9c9ca3',
              fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              {email.split('@')[0]}
            </span>
          )}
          <button className="leadership-nav-signout-desktop" onClick={signOut} style={{
            background: 'none',
            color: '#9c9ca3',
            fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 10px',
            border: '1px solid transparent',
            borderRadius: 4,
            cursor: 'pointer',
          }}>
            Sign out
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="leadership-hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'none',
              background: 'none',
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

      {/* Desktop contextual sub-row */}
      {showSubNav && (
        <div className="leadership-subnav-desktop" style={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          padding: '0 18px 10px',
          paddingLeft: 'max(18px, env(safe-area-inset-left))',
          paddingRight: 'max(18px, env(safe-area-inset-right))',
          overflowX: 'auto',
          borderTop: '1px solid #1a1a20',
          paddingTop: 8,
        }}>
          <SubTabs pathname={pathname} links={subLinks} />
        </div>
      )}

      {/* Mobile full-screen menu */}
      {menuOpen && (
        <MobileMenu pathname={pathname} email={email} onClose={() => setMenuOpen(false)} onSignOut={signOut} />
      )}

      <style>{`
        .leadership-subnav-desktop::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          .leadership-nav-divider { display: none; }
          .leadership-nav-tabs-desktop { display: none !important; }
          .leadership-subnav-desktop { display: none !important; }
          .leadership-nav-email { display: none !important; }
          .leadership-nav-signout-desktop { display: none !important; }
          .leadership-hamburger { display: inline-flex !important; }
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

function MobileMenu({ pathname, email, onClose, onSignOut }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        top: 'calc(env(safe-area-inset-top) + 65px)',
        background: '#0a0a0b',
        zIndex: 25,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '8px 0 calc(40px + env(safe-area-inset-bottom))',
      }}
    >
      {TOP_LINKS.map(link => {
        const active = isActive(pathname, link)
        return (
          <div key={link.href}>
            <a
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
                fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
                fontSize: 17,
                fontWeight: active ? 700 : 500,
                borderBottom: '1px solid #16161c',
              }}
            >
              {link.label}
              {active && <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#d4a333', boxShadow: '0 0 8px rgba(212,163,51,0.6)',
              }} />}
            </a>
            {/* Nested sub-links shown only when inside that group */}
            {link.children && isActive(pathname, link) && (
              <div style={{ background: '#0d0d10' }}>
                {link.children.map(child => {
                  const childActive = child.href === '/leadership/income' || child.href === '/leadership/drivers'
                    ? pathname === child.href
                    : matchesPath(pathname, child.href)
                  return (
                    <a
                      key={child.href}
                      href={child.href}
                      onClick={onClose}
                      style={{
                        display: 'block',
                        padding: '12px 22px 12px 38px',
                        paddingRight: 'max(22px, env(safe-area-inset-right))',
                        textDecoration: 'none',
                        color: childActive ? '#d4a333' : '#9c9ca3',
                        fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
                        fontSize: 15,
                        fontWeight: childActive ? 600 : 500,
                        borderBottom: '1px solid #16161c',
                      }}
                    >
                      {child.label}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 22px',
        paddingLeft: 'max(22px, env(safe-area-inset-left))',
        paddingRight: 'max(22px, env(safe-area-inset-right))',
      }}>
        {email && (
          <span style={{
            color: '#6f6f76',
            fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: 13,
          }}>
            {email}
          </span>
        )}
        <button onClick={onSignOut} style={{
          background: 'none',
          color: '#9c9ca3',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          padding: '8px 14px',
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
        const active = isActive(pathname, l)
        return (
          <a
            key={l.href}
            href={l.href}
            style={{
              color: active ? '#0a0a0b' : '#c8c8cc',
              background: active ? '#d4a333' : 'transparent',
              textDecoration: 'none',
              fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
              fontSize: '12px',
              fontWeight: active ? 600 : 500,
              padding: '6px 12px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              transition: 'color 0.12s, background 0.12s',
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

function SubTabs({ pathname, links }) {
  if (!Array.isArray(links) || !links.length) return null
  // Roots match exactly so they don't stay active when a sibling sub-page is open.
  const rootHrefs = new Set(['/leadership/income', '/leadership/drivers'])
  return (
    <>
      {links.map(l => {
        const active = rootHrefs.has(l.href)
          ? pathname === l.href
          : matchesPath(pathname, l.href)
        return (
          <a
            key={l.href}
            href={l.href}
            style={{
              color: active ? '#0a0a0b' : '#9c9ca3',
              background: active ? 'rgba(212,163,51,0.85)' : 'transparent',
              textDecoration: 'none',
              fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
              fontSize: '11px',
              fontWeight: active ? 600 : 500,
              padding: '4px 10px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              transition: 'color 0.12s, background 0.12s',
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
