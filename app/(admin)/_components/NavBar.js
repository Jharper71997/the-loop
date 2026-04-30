'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isLeadership } from '@/lib/roles'

const LINKS = [
  { href: '/admin', label: 'Schedule' },
  { href: '/admin/groups', label: 'Loops' },
  { href: '/admin/contacts', label: 'Contacts' },
  { href: '/admin/leaderboard', label: 'Leaderboard', leadership: true },
  { href: '/admin/notifications', label: 'Alerts', leadership: true },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState(null)
  const isLeader = isLeadership(email)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
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
    if (!search.trim()) { setResults([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const q = search.trim()
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, email')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8)
      if (!cancelled) setResults(data || [])
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search])

  if (pathname === '/login') {
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <nav className="admin-nav" style={{
      background: 'linear-gradient(180deg, #0d0d10, #0a0a0b)',
      borderBottom: '1px solid #2a2a31',
      boxShadow: '0 1px 0 rgba(212,163,51,0.25), 0 8px 24px rgba(0,0,0,0.5)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
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

        {/* Tabs — visible inline on desktop, on mobile they move to their own row below */}
        <div className="admin-nav-tabs-desktop" style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto' }}>
          <Tabs pathname={pathname} isLeader={isLeader} />
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

      {/* Mobile tabs row — hidden on desktop */}
      <div className="admin-nav-tabs-mobile" style={{
        display: 'none',
        gap: 6,
        padding: '0 10px 10px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        <Tabs pathname={pathname} mobile isLeader={isLeader} />
      </div>

      <style>{`
        .admin-nav-tabs-mobile::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          .admin-nav-divider { display: none; }
          .admin-nav-tabs-desktop { display: none !important; }
          .admin-nav-tabs-mobile { display: flex !important; }
          .admin-nav-search { display: none; }
          .admin-nav-email { display: none !important; }
        }
      `}</style>
    </nav>
  )
}

function Tabs({ pathname, mobile = false, isLeader = false }) {
  return (
    <>
      {LINKS.filter(l => isLeader || !l.leadership).map(l => {
        const active = l.href === '/admin'
          ? pathname === '/admin'
          : pathname === l.href || pathname.startsWith(l.href + '/')
        return (
          <a
            key={l.href}
            href={l.href}
            target={l.external ? '_blank' : undefined}
            rel={l.external ? 'noreferrer' : undefined}
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
