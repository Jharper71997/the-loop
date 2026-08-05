'use client'

// Brew Loop marketing-website header: brand lockup + desktop nav + Buy Tickets
// CTA + cart badge, collapsing to a hamburger drawer on mobile. Only mounts on
// Brew marketing pages (see RiderChrome). Styling mirrors TopBar's sticky/blur
// so it feels native to the app.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { brandFor } from '@/lib/businessConfig'
import { useCart } from '../merch/CartProvider'
import { NAV_LINKS, PRIMARY_CTA, UTILITY_LINK } from './nav'
import { GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, LINE, LINE_HI, BG, primaryCta } from '@/lib/marketingTheme'

const cfg = brandFor('brew')

export default function SiteHeader() {
  const pathname = usePathname() || '/'
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { count } = useCart()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll + close on Escape while the mobile drawer is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  const isActive = href => pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: scrolled ? 'rgba(10,10,11,0.94)' : 'rgba(10,10,11,0.72)',
        backdropFilter: 'saturate(160%) blur(14px)',
        WebkitBackdropFilter: 'saturate(160%) blur(14px)',
        borderBottom: `1px solid ${scrolled ? LINE : 'transparent'}`,
        transition: 'background 0.2s, border-color 0.2s',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <nav
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          minHeight: 56,
        }}
      >
        {/* Brand lockup */}
        <Link href="/" aria-label={`${cfg.brand} home`} style={brandLink}>
          <Logo size={40} />
          <span style={{ color: INK, fontSize: 15, fontWeight: 800, letterSpacing: '0.02em' }}>
            {cfg.brand}
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="bl-desktop-nav" style={{ marginLeft: 'auto', alignItems: 'center', gap: 4 }}>
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                color: isActive(l.href) ? GOLD_HI : INK_DIM,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {l.label}
            </Link>
          ))}
          {/* Utility, not a headline destination — visually quieter and set off
              from the browse links so a first-timer doesn't read it as step one. */}
          <Link
            href={UTILITY_LINK.href}
            style={{
              padding: '9px 12px', marginLeft: 8, borderRadius: 9,
              color: isActive(UTILITY_LINK.href) ? GOLD_HI : INK_MUTE,
              fontSize: 13.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
              borderLeft: `1px solid ${LINE}`, paddingLeft: 18,
            }}
          >
            {UTILITY_LINK.label}
          </Link>
          <Link href={PRIMARY_CTA.href} style={{ ...primaryCta, padding: '10px 18px', fontSize: 14, marginLeft: 6 }}>
            {PRIMARY_CTA.label}
          </Link>
          <CartButton count={count} />
        </div>

        {/* Mobile: cart + hamburger */}
        <div className="bl-mobile-nav" style={{ marginLeft: 'auto', alignItems: 'center', gap: 6 }}>
          <CartButton count={count} />
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            style={iconButton}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div style={drawer} onClick={e => e.stopPropagation()} role="dialog" aria-label="Menu">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Logo size={36} />
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} style={iconButton}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>
            {[...NAV_LINKS, UTILITY_LINK].map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={drawerLink(isActive(l.href))}>
                {l.label}
              </Link>
            ))}
            <Link href={PRIMARY_CTA.href} onClick={() => setOpen(false)} style={{ ...primaryCta, width: '100%', marginTop: 12 }}>
              {PRIMARY_CTA.label}
            </Link>
          </div>
        </div>
      )}

      <style>{`
        .bl-desktop-nav { display: none; }
        .bl-mobile-nav { display: flex; }
        @media (min-width: 860px) {
          .bl-desktop-nav { display: flex; }
          .bl-mobile-nav { display: none; }
        }
      `}</style>
    </header>
  )
}

function CartButton({ count }) {
  return (
    <Link href="/cart" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`} style={{ ...iconButton, position: 'relative', textDecoration: 'none' }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2 3h3l2.4 12.2a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.6-1.3L22 7H6" />
      </svg>
      {count > 0 && (
        <span aria-hidden style={cartBadge}>{count}</span>
      )}
    </Link>
  )
}

function Logo({ size = 40 }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/badge-gold.png" alt="Jville Brew Loop" style={{ width: size, height: size, objectFit: 'contain', display: 'block', flex: '0 0 auto' }} />
  )
}

const brandLink = { display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', flex: '0 0 auto' }
const iconButton = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 40, height: 40, borderRadius: 10, background: 'transparent',
  border: `1px solid ${LINE}`, cursor: 'pointer', color: INK,
}
const cartBadge = {
  position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px',
  borderRadius: 999, background: GOLD, color: BG, fontSize: 10.5, fontWeight: 800,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${BG}`,
}
const overlay = {
  position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
}
const drawer = {
  position: 'absolute', top: 0, right: 0, height: '100%', width: 'min(84vw, 320px)',
  background: '#0d0d10', borderLeft: `1px solid ${LINE_HI}`,
  padding: 'calc(16px + env(safe-area-inset-top)) 18px 24px',
  display: 'flex', flexDirection: 'column', gap: 2,
}
function drawerLink(active) {
  return {
    padding: '13px 12px', borderRadius: 10, textDecoration: 'none',
    color: active ? GOLD_HI : INK, fontSize: 16, fontWeight: 600,
    borderBottom: `1px solid ${LINE}`,
  }
}
