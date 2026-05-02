'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Leadership-only nav. Mirrors the admin NavBar look (black + gold HUD) but
// links to leadership-only sections. Middleware already gates access via
// LEADERSHIP_ONLY_PREFIXES; this nav just renders the chrome.

const LINKS = [
  { href: '/leadership',              label: 'Scoreboard' },
  { href: '/leadership/income',       label: 'Income' },
  { href: '/leadership/expenses',     label: 'Expenses' },
  { href: '/leadership/cash',         label: 'Cash' },
  { href: '/leadership/sponsors',     label: 'Sponsors' },
  { href: '/leadership/bars',         label: 'Bars' },
  { href: '/leadership/profit-first', label: 'Profit First' },
  { href: '/admin',                   label: 'Ops →', external: false },
]

export default function LeadershipNav() {
  const pathname = usePathname()
  const [email, setEmail] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || null))
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <nav style={{
      background: 'linear-gradient(180deg, #0d0d10, #0a0a0b)',
      borderBottom: '1px solid #2a2a31',
      boxShadow: '0 1px 0 rgba(212,163,51,0.25), 0 8px 24px rgba(0,0,0,0.5)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
      }}>
        <a href="/leadership" style={{
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
          LEADERSHIP
        </a>

        <span className="leadership-nav-divider" style={{
          width: 1, height: 18, background: '#2a2a31', flexShrink: 0,
        }} />

        <div className="leadership-nav-tabs-desktop" style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          overflowX: 'auto',
        }}>
          <Tabs pathname={pathname} />
        </div>

        <div className="leadership-nav-right" style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {email && (
            <span className="leadership-nav-email" style={{
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
          <button onClick={signOut} style={{
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
        </div>
      </div>

      <div className="leadership-nav-tabs-mobile" style={{
        display: 'none',
        gap: 6,
        padding: '0 10px 10px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        <Tabs pathname={pathname} mobile />
      </div>

      <style>{`
        .leadership-nav-tabs-mobile::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          .leadership-nav-divider { display: none; }
          .leadership-nav-tabs-desktop { display: none !important; }
          .leadership-nav-tabs-mobile { display: flex !important; }
          .leadership-nav-email { display: none !important; }
        }
      `}</style>
    </nav>
  )
}

function Tabs({ pathname, mobile = false }) {
  return (
    <>
      {LINKS.map(l => {
        const active = l.href === '/leadership'
          ? pathname === '/leadership'
          : pathname === l.href || pathname.startsWith(l.href + '/')
        return (
          <a
            key={l.href}
            href={l.href}
            style={{
              color: active ? '#0a0a0b' : '#c8c8cc',
              background: active ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : 'transparent',
              textDecoration: 'none',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: mobile ? '12px' : '11px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: mobile ? '10px 14px' : '5px 10px',
              borderRadius: mobile ? 8 : 4,
              border: active ? '1px solid rgba(0,0,0,0.4)' : '1px solid transparent',
              boxShadow: active ? '0 0 20px rgba(212,163,51,0.45)' : 'none',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, background 0.15s',
              minHeight: mobile ? 40 : undefined,
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
