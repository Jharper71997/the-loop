'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useCart } from '../_components/merch/CartProvider'
import { MerchImage, fmtPrice } from '../_components/merch/MerchBody'
import {
  GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, LINE, LINE_HI, MAX_W_NARROW,
  primaryCta, ghostCta, softCard, eyebrow,
} from '@/lib/marketingTheme'

export default function CartBody() {
  const { items, setQty, remove, subtotalCents, hydrated } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Stable idempotency token for this cart session, so a double-click doesn't
  // create two pending orders.
  const tokenRef = useRef(null)
  if (!tokenRef.current) {
    tokenRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `t_${Math.round(subtotalCents)}_${items.length}`
  }

  async function checkout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/merch/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_token: tokenRef.current,
          items: items.map(i => ({ productId: i.productId, variantId: i.variantId || null, quantity: i.qty })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || 'Checkout failed. Try again.')
      window.location.href = json.url
    } catch (err) {
      setError(err.message || 'Checkout failed. Try again.')
      setLoading(false)
    }
  }

  return (
    <main className="site-main" style={{ minHeight: '60vh' }}>
      <div style={{ maxWidth: MAX_W_NARROW, margin: '0 auto', padding: 'clamp(28px, 5vw, 52px) 16px clamp(48px, 7vw, 76px)' }}>
        <div style={eyebrow}>Your cart</div>
        <h1 style={{ color: INK, fontSize: 'clamp(26px, 4.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.015em', margin: '10px 0 0' }}>
          Bag
        </h1>

        {!hydrated ? null : items.length === 0 ? (
          <div style={{ ...softCard, textAlign: 'center', padding: '44px 24px', marginTop: 24 }}>
            <div style={{ color: INK, fontWeight: 700, fontSize: 18 }}>Your bag is empty</div>
            <p style={{ color: INK_DIM, fontSize: 14.5, margin: '10px 0 20px' }}>Grab some black-and-gold gear.</p>
            <Link href="/merch" style={primaryCta}>Shop merch</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
              {items.map(i => (
                <div key={`${i.productId}:${i.variantId || ''}`} style={{ ...softCard, padding: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flex: '0 0 auto', border: `1px solid ${LINE}` }}>
                    <MerchImage image={i.image} name={i.name} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: INK, fontSize: 15, fontWeight: 700 }}>{i.name}</div>
                    <div style={{ color: GOLD_HI, fontSize: 14, fontWeight: 700, marginTop: 3 }}>{fmtPrice(i.priceCents)}</div>
                    <button type="button" onClick={() => remove(i.productId, i.variantId)} style={{ marginTop: 6, background: 'none', border: 'none', color: INK_MUTE, fontSize: 12.5, cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      Remove
                    </button>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${LINE_HI}`, borderRadius: 9, flex: '0 0 auto' }}>
                    <QtyBtn onClick={() => setQty(i.productId, i.variantId, i.qty - 1)} label="Decrease">&minus;</QtyBtn>
                    <span style={{ minWidth: 30, textAlign: 'center', color: INK, fontWeight: 700, fontSize: 14 }}>{i.qty}</span>
                    <QtyBtn onClick={() => setQty(i.productId, i.variantId, i.qty + 1)} label="Increase">+</QtyBtn>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...softCard, padding: '20px 22px', marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: INK, fontSize: 15 }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 800 }}>{fmtPrice(subtotalCents)}</span>
              </div>
              <div style={{ color: INK_MUTE, fontSize: 12.5, marginTop: 6 }}>
                Shipping picked at checkout (or grab it on the shuttle, free).
              </div>
              {error && <div style={{ color: '#f87171', fontSize: 13.5, marginTop: 12 }}>{error}</div>}
              <button type="button" onClick={checkout} disabled={loading} style={{ ...primaryCta, width: '100%', marginTop: 16, opacity: loading ? 0.7 : 1, cursor: loading ? 'default' : 'pointer' }}>
                {loading ? 'Starting checkout…' : 'Checkout'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <Link href="/merch" style={{ color: INK_DIM, fontSize: 13.5, textDecoration: 'none' }}>Keep shopping</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function QtyBtn({ onClick, label, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} style={{ width: 34, height: 38, background: 'transparent', border: 'none', color: GOLD, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>
      {children}
    </button>
  )
}
