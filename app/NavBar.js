'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const LINKS = [
  { href: '/', label: 'Tonight' },
  { href: '/groups', label: 'Loops' },
  { href: '/finance', label: 'Finance' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState(null)
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

  if (pathname === '/login' || pathname.startsWith('/track') || pathname.startsWith('/book') || pathname.startsWith('/waiver')) {
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  return (
    <nav style={{
      background: '#0a0a0b',
      borderBottom: '1px solid #1e1e23',
      padding: '10px 16px',
      display: 'flex',
      gap: '14px',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <a href="/" style={{
        color: '#d4a333', fontWeight: 800, fontSize: '15px',
        whiteSpace: 'nowrap', textDecoration: 'none', letterSpacing: '0.04em',
      }}>
        The Loop
      </a>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', overflowX: 'auto' }}>
        {LINKS.map(l => {
          const active = l.href === '/'
            ? pathname === '/'
            : pathname === l.href || pathname.startsWith(l.href + '/')
          return (
            <a key={l.href} href={l.href} style={{
              color: active ? '#d4a333' : '#c8c8cc',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: active ? 700 : 500,
              whiteSpace: 'nowrap',
            }}>
              {l.label}
            </a>
          )
        })}
      </div>

      <div ref={boxRef} style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search riders…"
          style={{
            background: '#15151a',
            border: '1px solid #2a2a31',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 13,
            width: 180,
          }}
        />
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: '#15151a',
            border: '1px solid #2a2a31',
            borderRadius: 8,
            padding: 4,
            minWidth: 240,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 20,
          }}>
            {results.map(r => (
              <a
                key={r.id}
                href={`/contacts?focus=${r.id}`}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '8px 10px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  color: '#fff',
                  fontSize: 13,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#0a0a0b'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                <div style={{ fontSize: 11, color: '#9c9ca3' }}>{r.phone || r.email}</div>
              </a>
            ))}
          </div>
        )}

        {email && (
          <span style={{ color: '#6f6f76', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {email.split('@')[0]}
          </span>
        )}
        <button onClick={signOut} style={{
          background: 'none', color: '#6f6f76', fontSize: '12px', padding: '4px 6px', cursor: 'pointer',
        }}>
          Sign out
        </button>
      </div>
    </nav>
  )
}
