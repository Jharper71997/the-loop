'use client'

// Featured sponsor cards for /sponsors. Each is a glass card with a category
// chip, a contained logo, a description, and a "Visit site" CTA. Hover lifts the
// card with a gold glow. Client-side so the inline-style idiom can drive hover
// (no global CSS needed).

import { useState } from 'react'
import { SPONSORS } from '@/lib/sponsors'
import { GOLD, GOLD_HI, INK, INK_DIM, LINE, GOLD_WASH } from '@/lib/marketingTheme'

export default function SponsorGrid() {
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', marginTop: 30 }}>
      {SPONSORS.map(s => (
        <SponsorCard key={s.name} s={s} />
      ))}
    </div>
  )
}

function SponsorCard({ s }) {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      title={s.name}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 18,
        padding: 22,
        textDecoration: 'none',
        background: hover
          ? `linear-gradient(180deg, ${GOLD_WASH}, rgba(255,255,255,0.015))`
          : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))',
        border: `1px solid ${hover ? 'rgba(212,163,51,0.45)' : LINE}`,
        boxShadow: hover
          ? '0 16px 38px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(212,163,51,0.10)'
          : '0 1px 0 rgba(255,255,255,0.03)',
        transform: hover ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 170ms ease, border-color 170ms ease, box-shadow 170ms ease, background 170ms ease',
      }}
    >
      {/* Logo + category */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span
          style={{
            flex: '0 0 auto',
            width: 66,
            height: 66,
            borderRadius: 14,
            background: '#f5f3ee',
            display: 'grid',
            placeItems: 'center',
            padding: 9,
            overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.logo} alt={s.name} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </span>
        {s.tag ? (
          <span
            style={{
              flex: '0 0 auto',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: GOLD_HI,
              background: GOLD_WASH,
              border: '1px solid rgba(212,163,51,0.28)',
              borderRadius: 999,
              padding: '5px 11px',
              whiteSpace: 'nowrap',
            }}
          >
            {s.tag}
          </span>
        ) : null}
      </div>

      {/* Name + blurb */}
      <div style={{ marginTop: 18, flex: '1 1 auto' }}>
        <div style={{ color: INK, fontSize: 17.5, fontWeight: 800, letterSpacing: '-0.015em' }}>{s.name}</div>
        <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, margin: '8px 0 0' }}>{s.blurb}</p>
      </div>

      {/* Visit CTA */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: hover ? GOLD_HI : GOLD, fontSize: 13.5, fontWeight: 700 }}>Visit site</span>
        <span
          aria-hidden
          style={{ color: hover ? GOLD_HI : GOLD, fontSize: 13.5, transform: hover ? 'translateX(3px)' : 'none', transition: 'transform 170ms ease' }}
        >
          ↗
        </span>
      </div>
    </a>
  )
}
