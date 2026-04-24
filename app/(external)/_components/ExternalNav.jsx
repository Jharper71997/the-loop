'use client'

import { useState, useEffect } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const BG = '#0a0a0b'
const LINE = 'rgba(255,255,255,0.08)'

const LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/track', label: 'Track' },
  { href: '/bars', label: 'Partner Bars' },
  { href: '/about', label: 'About' },
  { href: '/my-tickets', label: 'My tickets' },
]

export default function ExternalNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
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
        background: scrolled ? 'rgba(10,10,11,0.92)' : 'rgba(10,10,11,0.7)',
        backdropFilter: 'saturate(140%) blur(12px)',
        WebkitBackdropFilter: 'saturate(140%) blur(12px)',
        borderBottom: `1px solid ${scrolled ? LINE : 'transparent'}`,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: INK,
            fontWeight: 700,
            letterSpacing: '0.02em',
            fontSize: 16,
          }}
          onClick={() => setOpen(false)}
        >
          <LoopMark />
          <span>Jville Brew Loop</span>
        </a>

        <div className="ext-nav-desktop" style={{ display: 'none', alignItems: 'center', gap: 24 }}>
          {LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              style={{
                color: INK_DIM,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = INK)}
              onMouseLeave={e => (e.currentTarget.style.color = INK_DIM)}
            >
              {l.label}
            </a>
          ))}
          <a href="/book" style={ctaStyle}>Book a ride</a>
        </div>

        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className="ext-nav-burger"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            border: `1px solid ${LINE}`,
            background: 'rgba(255,255,255,0.03)',
            color: INK,
            borderRadius: 8,
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
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: `1px solid ${LINE}`,
              background: BG,
            }}
          >
            <a
              href="/"
              onClick={() => setOpen(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                color: INK,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              <LoopMark />
              <span>Jville Brew Loop</span>
            </a>
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                border: `1px solid ${LINE}`,
                background: 'rgba(255,255,255,0.04)',
                color: INK,
                borderRadius: 10,
                cursor: 'pointer',
                padding: 0,
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <nav style={{ padding: '12px 20px 32px', display: 'flex', flexDirection: 'column' }}>
            {LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 4px',
                  fontSize: 22,
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
            <a
              href="/book"
              onClick={() => setOpen(false)}
              style={{
                ...ctaStyle,
                marginTop: 28,
                display: 'block',
                textAlign: 'center',
                fontSize: 17,
                padding: '18px 24px',
                borderRadius: 14,
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              Book a ride
            </a>

            <div
              style={{
                marginTop: 28,
                paddingTop: 20,
                borderTop: `1px solid ${LINE}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <a
                href="sms:+16362661801"
                style={{ color: INK_DIM, fontSize: 14, textDecoration: 'none' }}
              >
                Text us: (636) 266-1801
              </a>
              <a
                href="mailto:hello@jvillebrewloop.com"
                style={{ color: INK_DIM, fontSize: 14, textDecoration: 'none' }}
              >
                hello@jvillebrewloop.com
              </a>
            </div>
          </nav>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .ext-nav-desktop { display: flex !important; }
          .ext-nav-burger { display: none !important; }
        }
      `}</style>
    </header>
  )
}

const ctaStyle = {
  display: 'inline-block',
  padding: '10px 18px',
  borderRadius: 999,
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
  color: '#0a0a0b',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: '0.01em',
  boxShadow: '0 6px 20px rgba(212,163,51,0.25)',
}

function LoopMark() {
  return (
    <span
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: `2px solid ${GOLD}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 30% 30%, rgba(240,194,74,0.3), transparent 70%)',
      }}
    >
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: GOLD,
        boxShadow: `0 0 10px ${GOLD}`,
      }} />
    </span>
  )
}

function Burger({ open }) {
  const bar = {
    display: 'block',
    width: 18,
    height: 2,
    background: INK,
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
