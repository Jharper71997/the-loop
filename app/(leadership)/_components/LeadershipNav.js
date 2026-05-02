'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Calmer redesign — system sans, mono only on numbers, subtler gold accents.

const LINKS = [
  { href: '/leadership',          label: 'Scoreboard' },
  { href: '/leadership/income',   label: 'Income' },
  { href: '/leadership/expenses', label: 'Expenses' },
  { href: '/leadership/cash',     label: 'Cash' },
  { href: '/leadership/sponsors', label: 'Sponsors' },
  { href: '/leadership/bars',     label: 'Bars' },
  { href: '/leadership/drivers',  label: 'Drivers' },
  { href: '/admin',               label: 'Ops →' },
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
      background: '#0d0d10',
      borderBottom: '1px solid #2a2a31',
      position: 'sticky',
      top: 0,
      zIndex: 10,
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
          <Tabs pathname={pathname} />
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
          <button onClick={signOut} style={{
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
        </div>
      </div>

      <div className="leadership-nav-tabs-mobile" style={{
        display: 'none',
        gap: 2,
        padding: '0 12px 10px',
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
              background: active ? '#d4a333' : 'transparent',
              textDecoration: 'none',
              fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
              fontSize: mobile ? '13px' : '12px',
              fontWeight: active ? 600 : 500,
              padding: mobile ? '8px 14px' : '6px 12px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              transition: 'color 0.12s, background 0.12s',
              minHeight: mobile ? 36 : undefined,
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
