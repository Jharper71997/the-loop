'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const LINE = 'rgba(255,255,255,0.08)'

export default function TopBar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: scrolled ? 'rgba(10,10,11,0.94)' : 'rgba(10,10,11,0.78)',
        backdropFilter: 'saturate(160%) blur(14px)',
        WebkitBackdropFilter: 'saturate(160%) blur(14px)',
        borderBottom: `1px solid ${scrolled ? LINE : 'transparent'}`,
        transition: 'background 0.2s, border-color 0.2s',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 52,
        }}
      >
        <Link
          href="/"
          aria-label="Jville Brew Loop home"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `1.5px solid ${GOLD}`,
              color: GOLD,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.04em',
              background: 'radial-gradient(60% 60% at 50% 40%, rgba(212,163,51,0.18), transparent 70%)',
            }}
          >
            JBL
          </span>
          <span style={{
            color: INK,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            Jville Brew Loop
          </span>
        </Link>
      </nav>
    </header>
  )
}
