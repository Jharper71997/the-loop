'use client'

// Featured merch product card for the /merch grid. Glass card, product photo on
// top with a subtle zoom on hover, price + size range below, gold hover lift.
// Client-side so the inline-style idiom can drive hover (matches SponsorGrid).

import Link from 'next/link'
import { useState } from 'react'
import { GOLD, GOLD_HI, INK, INK_DIM, LINE } from '@/lib/marketingTheme'

function fmt(cents) {
  if (cents == null) return ''
  const d = cents / 100
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`
}

export default function MerchCard({ product }) {
  const [hover, setHover] = useState(false)
  const hasVariants = !!product.variants?.length
  const from = hasVariants ? Math.min(...product.variants.map(v => v.priceCents)) : product.priceCents
  const sizes = hasVariants ? `${product.variants[0].name}–${product.variants[product.variants.length - 1].name}` : null

  return (
    <Link
      href={`/merch/${product.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 18,
        overflow: 'hidden',
        textDecoration: 'none',
        border: `1px solid ${hover ? 'rgba(212,163,51,0.45)' : LINE}`,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))',
        boxShadow: hover ? '0 16px 38px rgba(0,0,0,0.45)' : '0 1px 0 rgba(255,255,255,0.03)',
        transform: hover ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 170ms ease, border-color 170ms ease, box-shadow 170ms ease',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderBottom: `1px solid ${LINE}` }}>
        {product.image ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: `url(${product.image}) center/cover`,
              transform: hover ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 320ms ease',
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'radial-gradient(90% 80% at 50% 20%, rgba(212,163,51,0.18), transparent 60%), #101014',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/badge-gold.png" alt="" style={{ width: 84, height: 84, objectFit: 'contain', opacity: 0.92 }} />
          </div>
        )}
      </div>
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ color: INK, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{product.name}</div>
        {product.description && (
          <p style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '6px 0 0' }}>{product.description}</p>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: GOLD_HI, fontSize: 16, fontWeight: 800 }}>
            {hasVariants ? 'From ' : ''}{fmt(from)}
          </span>
          {sizes ? (
            <span style={{ color: INK_DIM, fontSize: 12, fontWeight: 600, border: `1px solid ${LINE}`, borderRadius: 999, padding: '3px 9px' }}>{sizes}</span>
          ) : (
            <span style={{ color: hover ? GOLD_HI : GOLD, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              View <span aria-hidden style={{ transform: hover ? 'translateX(2px)' : 'none', transition: 'transform 170ms ease' }}>&rarr;</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
