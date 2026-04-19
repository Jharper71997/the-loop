'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/', label: 'Riders' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/groups', label: 'Loops' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/orders', label: 'Orders' },
  { href: '/waivers', label: 'Waivers' },
  { href: '/finance', label: 'Finance' },
]

export default function NavBar() {
  const pathname = usePathname()
  const [email, setEmail] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || null))
  }, [])

  if (pathname === '/login') return null

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
      overflowX: 'auto',
    }}>
      <span style={{ color: '#d4a333', fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap' }}>
        The Loop
      </span>
      {LINKS.map(l => {
        const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href))
        return (
          <a
            key={l.href}
            href={l.href}
            style={{
              color: active ? '#d4a333' : '#c8c8cc',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: active ? 600 : 500,
              whiteSpace: 'nowrap',
            }}
          >
            {l.label}
          </a>
        )
      })}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
        {email && (
          <span style={{ color: '#6f6f76', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {email.split('@')[0]}
          </span>
        )}
        <button
          onClick={signOut}
          style={{
            background: 'none',
            color: '#6f6f76',
            fontSize: '12px',
            padding: '4px 6px',
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
