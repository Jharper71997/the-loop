'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'
const BG = '#0a0a0b'
const LINE = 'rgba(255,255,255,0.08)'

const MORE_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/bartender-signup', label: 'Bartender signup' },
]

export default function TopBar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

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
          justifyContent: 'space-between',
          gap: 12,
          minHeight: 52,
        }}
      >
        <Link
          href="/"
          aria-label="Jville Brew Loop home"
          onClick={() => setOpen(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          <Image
            src="/brand/wordmark-gold-on-black.png"
            alt="Jville Brew Loop"
            width={156}
            height={32}
            priority
            style={{ height: 28, width: 'auto', display: 'block' }}
          />
        </Link>

        <button
          aria-label={open ? 'Close menu' : 'More'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            border: `1px solid ${LINE}`,
            background: 'rgba(255,255,255,0.03)',
            color: INK,
            borderRadius: 10,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Burger open={open} />
        </button>
      </nav>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: BG,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: `1px solid ${LINE}`,
              background: BG,
              minHeight: 52,
            }}
          >
            <Link
              href="/"
              onClick={() => setOpen(false)}
              aria-label="Jville Brew Loop home"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              <Image
                src="/brand/wordmark-gold-on-black.png"
                alt="Jville Brew Loop"
                width={156}
                height={32}
                style={{ height: 28, width: 'auto', display: 'block' }}
              />
            </Link>
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{
                width: 44,
                height: 44,
                border: `1px solid ${LINE}`,
                background: 'rgba(255,255,255,0.04)',
                color: INK,
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <nav style={{ padding: '8px 14px 28px', display: 'flex', flexDirection: 'column' }}>
            {MORE_LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 4px',
                  fontSize: 20,
                  fontWeight: 600,
                  color: INK,
                  textDecoration: 'none',
                  borderBottom: `1px solid ${LINE}`,
                  minHeight: 60,
                }}
              >
                <span>{l.label}</span>
                <span style={{ color: GOLD, fontSize: 18 }}>&rsaquo;</span>
              </a>
            ))}

            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: `1px solid ${LINE}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <a href="sms:+16362661801" style={{ color: INK_DIM, fontSize: 14, textDecoration: 'none' }}>
                Text us: (636) 266-1801
              </a>
              <a href="mailto:hello@jvillebrewloop.com" style={{ color: INK_DIM, fontSize: 14, textDecoration: 'none' }}>
                hello@jvillebrewloop.com
              </a>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${LINE}`,
              }}
            >
              <a
                href="/login"
                onClick={() => setOpen(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                  color: GOLD,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  minHeight: 44,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: GOLD, boxShadow: `0 0 8px ${GOLD}`,
                  }}
                />
                Staff sign in
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

function Burger({ open }) {
  const bar = {
    display: 'block',
    width: 18,
    height: 2,
    background: '#f5f5f7',
    borderRadius: 2,
    transition: 'transform 0.2s, opacity 0.2s',
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...bar, transform: open ? 'translateY(6px) rotate(45deg)' : 'none' }} />
      <span style={{ ...bar, opacity: open ? 0 : 1 }} />
      <span style={{ ...bar, transform: open ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
    </span>
  )
}
