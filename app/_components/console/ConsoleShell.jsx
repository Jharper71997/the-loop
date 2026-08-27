'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isLeadership, isSecurity, isDriver, isPartyBuilder } from '@/lib/roles'
import { sectionForPath, visibleSections } from './sections'
import { T } from './theme'

// One shell for the whole staff console — /admin and /leadership both.
//
// The old shell was near-black with a gold hairline, a sidebar of five sections
// and a scrolling tab row under the header. Two rows of navigation over a page
// you were already squinting at. This is the same information with the volume
// turned up: cream page, white cards, one row of navigation, and destinations
// big enough to hit with a thumb while the bus is moving.
//
// Desktop gets the sidebar. Phones get a bottom bar instead of a drawer, since
// every person using this on a Friday night is holding a phone one-handed and
// a hamburger costs two taps to reach the same four places.

const ICONS = {
  bus: 'M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10M4 16h16M4 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2m10 0v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M6 8h12M7 12h.01M17 12h.01',
  ticket: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z M14 6v2m0 4v2m0 4v-2',
  people: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 8v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  scan: 'M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2M3 12h18',
  wheel: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M12 3v6m-6.5 9L10 14m4 0 4.5 4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3',
  // A private party IS its link, so the desk that mints them gets a key.
  key: 'M15.5 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z M12.3 11.7 3.5 20.5 M6.5 17.5l2.5 2.5',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
}

function Icon({ name, active, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? T.ON_GOLD : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: `0 0 ${size}px` }}>
      <path d={ICONS[name] || ICONS.gear} />
    </svg>
  )
}

const CSS = `
        html, body { background: ${T.PAPER}; }
        .cs-root {
          min-height: 100dvh;
          background: ${T.PAPER};
          color: ${T.INK};
          font-family: ${T.SANS};
          color-scheme: light;

          /* globals.css is shared with the rider-facing site, which is still
             (correctly) dark. Rather than fork every .card / .btn / input in
             the console, re-point the same variables for anything rendered
             inside this shell. The public tree never sees these. */
          --bg: ${T.PAPER};
          --bg-1: ${T.CARD};
          --bg-2: ${T.CARD_ALT};
          --bg-3: ${T.SUNK};
          --ink: ${T.INK};
          --ink-dim: ${T.DIM};
          --ink-muted: #7d7060;
          --ink-faint: ${T.FAINT};
          --line: ${T.LINE};
          --line-hi: ${T.LINE_HI};
          --gold-dim: ${T.GOLD_TXT};
          --gold-glow: rgba(212,163,51,0.30);
          --gold-wash: rgba(212,163,51,0.12);
        }
        /* The global h1 is near-white with a gold glow behind it — invisible on
           paper. Same headline, daylight version. */
        .cs-root h1, .cs-root h2, .cs-root h3 { color: ${T.INK}; text-shadow: none; }
        .cs-root select option, .cs-root select optgroup {
          background: ${T.CARD}; color: ${T.INK};
        }
        .cs-grid { display: grid; grid-template-columns: 236px 1fr; min-height: 100dvh; }

        .cs-side {
          display: flex; flex-direction: column;
          border-right: 1px solid ${T.LINE};
          background: ${T.CARD};
          position: sticky; top: 0; height: 100dvh;
        }
        .cs-nav { display: flex; flex-direction: column; gap: 4px; padding: 0 10px 14px; }
        .cs-link {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 12px; border-radius: 12px;
          text-decoration: none; color: ${T.DIM};
          border: 1px solid transparent;
        }
        .cs-link:hover { background: ${T.CARD_ALT}; border-color: ${T.LINE}; color: ${T.INK}; }
        .cs-link.on {
          background: linear-gradient(180deg, ${T.GOLD_HI}, ${T.GOLD});
          border-color: ${T.GOLD};
          color: ${T.ON_GOLD};
          box-shadow: 0 1px 0 rgba(35,25,3,0.12);
        }
        .cs-label { display: block; font-size: 14.5px; font-weight: 700; letter-spacing: -0.01em; }
        .cs-blurb { display: block; font-size: 11.5px; font-weight: 500; opacity: 0.72; margin-top: 1px; }

        .cs-foot { margin-top: auto; padding: 14px 16px; border-top: 1px solid ${T.LINE}; }
        .cs-chip {
          display: inline-block;
          background: ${T.CARD_ALT}; border: 1px solid ${T.LINE}; color: ${T.DIM};
          border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 600;
          text-decoration: none; font-family: inherit;
        }
        .cs-chip:hover { color: ${T.INK}; border-color: ${T.LINE_HI}; }

        .cs-head {
          position: sticky; top: 0; z-index: 20;
          background: ${T.CARD};
          border-bottom: 1px solid ${T.LINE};
        }
        .cs-head-in {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 11px 18px;
        }
        .cs-head-day {
          flex: 0 0 auto;
          font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
          color: ${T.GOLD_TXT}; background: ${T.GOLD_BG};
          border: 1px solid ${T.GOLD}; border-radius: 999px; padding: 5px 11px;
        }

        .cs-bottom { display: none; }

        @media (max-width: 860px) {
          .cs-grid { grid-template-columns: 1fr; }
          .cs-side { display: none; }
          .cs-head-in { padding: 10px 14px; }
          .cs-bottom {
            display: flex;
            position: fixed; z-index: 50; left: 0; right: 0; bottom: 0;
            background: ${T.CARD};
            border-top: 1px solid ${T.LINE};
            padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
            overflow-x: auto;
          }
          .cs-tab {
            flex: 1 0 auto; min-width: 64px;
            display: flex; flex-direction: column; align-items: center; gap: 3px;
            padding: 7px 6px; margin: 0 2px; border-radius: 12px;
            text-decoration: none; color: ${T.DIM};
            font-size: 10.5px; font-weight: 700; letter-spacing: -0.01em;
          }
          .cs-tab.on {
            background: linear-gradient(180deg, ${T.GOLD_HI}, ${T.GOLD});
            color: ${T.ON_GOLD};
          }
          /* room for the bar so the last row of any page stays reachable */
          .cs-root { padding-bottom: calc(66px + env(safe-area-inset-bottom)); }
        }
        @media (max-width: 430px) {
          /* the section name has to win the header on a phone */
          .cs-head-day { display: none; }
        }
`

// "Friday night" reads better on a console you open to run a Friday night than
// a timestamp does.
function tonightLabel() {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'long' })
  const hour = now.getHours()
  if (hour >= 17) return `${day} night`
  if (hour < 5) return 'Still out there'
  return day
}

export default function ConsoleShell({ children }) {
  const pathname = usePathname() || '/'
  const [email, setEmail] = useState(null)
  const [when, setWhen] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || null))
  }, [])

  // Client-only so the server render can't disagree with the browser clock.
  useEffect(() => { setWhen(tonightLabel()) }, [pathname])

  const roles = {
    isLeader: isLeadership(email),
    isSec: isSecurity(email),
    isDrv: isDriver(email),
    isParty: isPartyBuilder(email),
  }

  const sections = visibleSections(roles)
  const current = sectionForPath(pathname)

  // Login and signup sit inside this route group, so they used to render the
  // whole console around themselves — a nav bar of places you can't go and a
  // Sign out button, shown to someone who isn't signed in. Just the page.
  if (pathname === '/login' || pathname === '/signup') {
    return (
      <div className="cs-root">
        {children}
        <style>{CSS}</style>
      </div>
    )
  }

  return (
    <div className="cs-root">
      <div className="cs-grid">

        {/* ---- sidebar (desktop) ---- */}
        <aside className="cs-side">
          <div style={{ padding: '20px 16px 16px' }}>
            <Link href="/admin" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ color: T.GOLD_TXT, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
                Jville Brew Loop
              </div>
              <div style={{ color: T.INK, fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 3 }}>
                {when || 'Staff'}
              </div>
            </Link>
          </div>

          <nav className="cs-nav">
            {sections.map(s => {
              const active = current?.key === s.key
              return (
                <Link key={s.key} href={s.href} className={`cs-link${active ? ' on' : ''}`}>
                  <Icon name={s.icon} active={active} />
                  <span style={{ minWidth: 0 }}>
                    <span className="cs-label">{s.label}</span>
                    <span className="cs-blurb">{s.blurb}</span>
                  </span>
                </Link>
              )
            })}
          </nav>

          <div className="cs-foot">
            {/* Surf and Marines still run their own console tree on their own
                URLs; leadership needs a door back to them. */}
            {roles.isLeader && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <a href="/surf" className="cs-chip">Surf City</a>
                <a href="/loop" className="cs-chip">Marines</a>
              </div>
            )}
            <div style={{ color: T.FAINT, fontSize: 11, wordBreak: 'break-all', marginBottom: 8 }}>
              {email || '—'}
            </div>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              className="cs-chip"
              style={{ cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* ---- content ---- */}
        <div style={{ minWidth: 0 }}>
          <header className="cs-head">
            <div className="cs-head-in">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: T.INK }}>
                  {current?.label || 'Console'}
                </div>
                {current?.blurb && (
                  <div style={{ fontSize: 12.5, color: T.DIM, marginTop: 1 }}>{current.blurb}</div>
                )}
              </div>
              <div className="cs-head-day">{when}</div>
            </div>
          </header>

          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </div>

      {/* ---- bottom bar (phones) ---- */}
      <nav className="cs-bottom">
        {sections.map(s => {
          const active = current?.key === s.key
          return (
            <Link key={s.key} href={s.href} className={`cs-tab${active ? ' on' : ''}`}>
              <Icon name={s.icon} active={active} size={21} />
              <span>{s.label}</span>
            </Link>
          )
        })}
      </nav>

      <style>{CSS}</style>
    </div>
  )
}
