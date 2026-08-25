'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isLeadership, isSecurity, isDriver } from '@/lib/roles'
import { sectionForPath, visibleSections, visibleTabs } from './sections'

// One shell for the whole staff console. Wraps both /admin and /leadership so
// the two stop reading as two products: same sidebar, same tabs, same type,
// same spacing, on every staff page.
//
// Deliberately quieter than the old HUD chrome — no grid overlay, no scanlines,
// no glow. A console you stare at on a Saturday night should get out of the way.

const BG = '#0a0a0b'
const PANEL = '#0d0d10'
const LINE = '#1e1e23'
const INK = '#e8e8ea'
const DIM = '#8e8e96'
const GOLD = '#d4a333'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif'

const ICONS = {
  bus: 'M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10M4 16h16M4 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2m10 0v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M6 8h12M7 12h.01M17 12h.01',
  people: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 8v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  dollar: 'M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
}

const consoleLink = {
  color: DIM, fontSize: 12.5, textDecoration: 'none',
  padding: '5px 8px', borderRadius: 6, border: `1px solid ${LINE}`,
}

function Icon({ name, active }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? GOLD : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: '0 0 17px' }}>
      <path d={ICONS[name] || ICONS.gear} />
    </svg>
  )
}

export default function ConsoleShell({ children }) {
  const pathname = usePathname() || '/'
  const [email, setEmail] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || null))
  }, [])

  // Close the mobile drawer on navigation — otherwise it stays open over the
  // page you just asked for.
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const roles = {
    isLeader: isLeadership(email),
    isSec: isSecurity(email),
    isDrv: isDriver(email),
  }

  const sections = visibleSections(roles)
  const current = sectionForPath(pathname)
  const tabs = visibleTabs(current, roles)

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: INK, fontFamily: SANS }}>
      <div className="console-grid">

        {/* ---- sidebar ---- */}
        <aside className={`console-side${menuOpen ? ' open' : ''}`}>
          <div style={{ padding: '18px 14px 14px' }}>
            <Link href="/admin" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ color: GOLD, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
                Jville Brew Loop
              </div>
              <div style={{ color: INK, fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em', marginTop: 2 }}>
                Staff console
              </div>
            </Link>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px 14px' }}>
            {sections.map(s => {
              const active = current?.key === s.key
              return (
                <Link
                  key={s.key}
                  href={s.href}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? INK : DIM,
                    background: active ? 'rgba(212,163,51,0.10)' : 'transparent',
                  }}
                >
                  {active && (
                    <span style={{
                      position: 'absolute', left: 0, top: 8, bottom: 8,
                      width: 2, borderRadius: 2, background: GOLD,
                    }} />
                  )}
                  <Icon name={s.icon} active={active} />
                  {s.label}
                </Link>
              )
            })}
          </nav>

          {/* The old NavBar carried jump links between the three staff consoles.
              Brew is this shell; Surf and Marines still run the older NavBar on
              their own URL trees, so leadership needs a way back to them. */}
          {roles.isLeader && (
            <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: `1px solid ${LINE}` }}>
              <div style={{ color: DIM, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
                Other consoles
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <a href="/surf" style={consoleLink}>Surf City ops</a>
                <a href="/loop" style={consoleLink}>The Loop ops</a>
              </div>
            </div>
          )}

          <div style={{ marginTop: roles.isLeader ? 0 : 'auto', padding: '14px', borderTop: `1px solid ${LINE}` }}>
            <div style={{ color: DIM, fontSize: 11, wordBreak: 'break-all', marginBottom: 8 }}>
              {email || '—'}
            </div>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              style={{
                background: 'none', border: `1px solid ${LINE}`, color: DIM,
                borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* ---- content ---- */}
        <div style={{ minWidth: 0 }}>
          <header style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: PANEL, borderBottom: `1px solid ${LINE}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
              <button
                type="button"
                className="console-burger"
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Menu"
                aria-expanded={menuOpen}
                style={{
                  background: 'none', border: `1px solid ${LINE}`, color: INK,
                  borderRadius: 8, padding: '6px 10px', fontSize: 15, cursor: 'pointer', lineHeight: 1,
                }}
              >
                ☰
              </button>
              <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em' }}>
                {current?.label || 'Console'}
              </div>
            </div>

            {tabs.length > 1 && (
              <div style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '0 10px' }}>
                {tabs.map(t => {
                  const on = t.exact
                    ? pathname === t.href
                    : pathname === t.href || pathname.startsWith(t.href + '/')
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      style={{
                        flexShrink: 0,
                        padding: '9px 11px',
                        fontSize: 13,
                        textDecoration: 'none',
                        color: on ? INK : DIM,
                        fontWeight: on ? 600 : 500,
                        borderBottom: `2px solid ${on ? GOLD : 'transparent'}`,
                      }}
                    >
                      {t.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </header>

          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="console-scrim"
        />
      )}

      <style>{`
        .console-grid { display: grid; grid-template-columns: 214px 1fr; min-height: 100dvh; }
        .console-side {
          display: flex; flex-direction: column;
          border-right: 1px solid ${LINE};
          background: ${PANEL};
          position: sticky; top: 0; height: 100dvh;
        }
        .console-burger { display: none; }
        .console-scrim {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,0.55); border: none; cursor: pointer;
        }
        @media (max-width: 860px) {
          .console-grid { grid-template-columns: 1fr; }
          .console-side {
            position: fixed; z-index: 50; left: 0; top: 0;
            width: 236px; transform: translateX(-100%);
            transition: transform 0.18s ease;
          }
          .console-side.open { transform: none; }
          .console-burger { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .console-side { transition: none; }
        }
      `}</style>
    </div>
  )
}
