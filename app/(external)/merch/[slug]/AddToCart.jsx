'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '../../_components/merch/CartProvider'
import { GOLD, GOLD_HI, INK, INK_DIM, LINE, LINE_HI, primaryCta } from '@/lib/marketingTheme'

// Variant picker + quantity + add-to-cart. Receives a serializable product from
// the server page.
export default function AddToCart({ product }) {
  const { add } = useCart()
  const hasVariants = product.variants?.length > 0
  const [variantId, setVariantId] = useState(hasVariants ? product.variants[0].id : null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const variant = hasVariants ? product.variants.find(v => v.id === variantId) : null
  const priceCents = variant ? variant.priceCents : product.priceCents

  function onAdd() {
    add({
      productId: product.id,
      slug: product.slug,
      variantId: variantId || null,
      name: variant ? `${product.name} — ${variant.name}` : product.name,
      priceCents,
      image: product.image || null,
    }, qty)
    setAdded(true)
    setQty(1)
  }

  return (
    <div style={{ marginTop: 22 }}>
      {hasVariants && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: INK_DIM, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Size</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {product.variants.map(v => {
              const on = v.id === variantId
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setVariantId(v.id); setAdded(false) }}
                  style={{
                    minWidth: 48, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    background: on ? 'rgba(212,163,51,0.14)' : 'transparent',
                    border: `1px solid ${on ? GOLD : LINE_HI}`,
                    color: on ? GOLD_HI : INK, fontWeight: 700, fontSize: 14,
                  }}
                >
                  {v.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${LINE_HI}`, borderRadius: 10, overflow: 'hidden' }}>
          <QtyBtn onClick={() => setQty(q => Math.max(1, q - 1))} label="Decrease quantity">&minus;</QtyBtn>
          <span style={{ minWidth: 38, textAlign: 'center', color: INK, fontWeight: 700, fontSize: 15 }}>{qty}</span>
          <QtyBtn onClick={() => setQty(q => q + 1)} label="Increase quantity">+</QtyBtn>
        </div>
        <button type="button" onClick={onAdd} style={{ ...primaryCta, flex: '1 1 auto', minWidth: 160 }}>
          Add to cart
        </button>
      </div>

      {added && (
        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', color: INK_DIM, fontSize: 14 }}>
          <span style={{ color: GOLD_HI, fontWeight: 700 }}>Added &check;</span>
          <Link href="/cart" style={{ color: INK, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>Go to cart</Link>
        </div>
      )}
    </div>
  )
}

function QtyBtn({ onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ width: 40, height: 42, background: 'transparent', border: 'none', color: GOLD, fontSize: 20, fontWeight: 700, cursor: 'pointer' }}
    >
      {children}
    </button>
  )
}
