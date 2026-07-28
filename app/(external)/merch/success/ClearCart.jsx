'use client'

import { useEffect } from 'react'
import { useCart } from '../../_components/merch/CartProvider'

// Empties the cart once, after a successful merch checkout.
export default function ClearCart() {
  const { clear } = useCart()
  useEffect(() => { clear() }, [clear])
  return null
}
