'use client'

// Product image gallery for /merch/[slug]: a large lead image plus a row of
// clickable thumbnails. Client-side so tapping a thumb swaps the main image.

import { useState } from 'react'
import { LINE } from '@/lib/marketingTheme'

export default function MerchGallery({ images = [], name = '' }) {
  const pics = (images || []).filter(Boolean)
  const [active, setActive] = useState(0)

  if (!pics.length) {
    return (
      <div
        aria-hidden
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 16,
          border: `1px solid ${LINE}`,
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(90% 80% at 50% 20%, rgba(212,163,51,0.18), transparent 60%), #101014',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/badge-gold.png" alt="" style={{ width: 96, height: 96, objectFit: 'contain', opacity: 0.92 }} />
      </div>
    )
  }

  const main = pics[Math.min(active, pics.length - 1)]

  return (
    <div>
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 16,
          overflow: 'hidden',
          border: `1px solid ${LINE}`,
          background: `url(${main}) center/cover`,
        }}
      />
      {pics.length > 1 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {pics.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${name} photo ${i + 1}`}
              style={{
                width: 66,
                height: 66,
                borderRadius: 11,
                overflow: 'hidden',
                cursor: 'pointer',
                padding: 0,
                background: `url(${src}) center/cover`,
                border: `1px solid ${i === active ? 'rgba(212,163,51,0.75)' : LINE}`,
                boxShadow: i === active ? '0 0 0 1px rgba(212,163,51,0.4)' : 'none',
                opacity: i === active ? 1 : 0.72,
                transition: 'opacity 150ms ease, border-color 150ms ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
