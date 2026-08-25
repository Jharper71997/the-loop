'use client'

// Client-side merch cart, persisted to localStorage ('bl_cart'). Mounted once by
// RiderChrome so the header badge, /merch, /merch/[slug] and /cart all share one
// cart. Hydration-safe: we read localStorage in an effect (not during render) so
// server and first client render match.

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'bl_cart'

// A cart line key is product + variant, so the same product in two variants are
// distinct lines but adding the same variant twice bumps quantity.
const lineKey = i => `${i.productId}:${i.variantId || ''}`

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setItems(parsed.filter(p => p && p.productId && p.qty > 0))
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }, [items, hydrated])

  // item: { productId, slug, variantId?, name, priceCents, image? }
  const add = useCallback((item, qty = 1) => {
    setItems(prev => {
      const idx = prev.findIndex(p => lineKey(p) === lineKey(item))
      if (idx >= 0) {
        const next = prev.slice()
        next[idx] = { ...next[idx], qty: next[idx].qty + qty }
        return next
      }
      return [...prev, { ...item, qty }]
    })
  }, [])

  const setQty = useCallback((productId, variantId, qty) => {
    setItems(prev => prev
      .map(p => (p.productId === productId && (p.variantId || '') === (variantId || ''))
        ? { ...p, qty: Math.max(0, qty) } : p)
      .filter(p => p.qty > 0))
  }, [])

  const remove = useCallback((productId, variantId) => {
    setItems(prev => prev.filter(p => !(p.productId === productId && (p.variantId || '') === (variantId || ''))))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const count = useMemo(() => items.reduce((n, p) => n + p.qty, 0), [items])
  const subtotalCents = useMemo(() => items.reduce((n, p) => n + (p.priceCents || 0) * p.qty, 0), [items])

  const value = useMemo(
    () => ({ items, add, setQty, remove, clear, count, subtotalCents, hydrated }),
    [items, add, setQty, remove, clear, count, subtotalCents, hydrated],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
