'use client'

// Shares the active staff business (Brew vs Surf City) across the /admin HUD.
//
// Server pages read the `business` cookie directly via lib/businessServer; the
// two top-level 'use client' pages (contacts, finance) and the NavBar toggle
// read it here. Initial state is 'brew' to match SSR (the cookie is read after
// mount), so there's no hydration mismatch; toggling writes the cookie and
// router.refresh()es so server pages re-render with the new scope.

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readBusinessCookie, setBusinessCookie } from '@/lib/business'

const BusinessContext = createContext({ business: 'brew', setBusiness: () => {} })

export function BusinessProvider({ children }) {
  const router = useRouter()
  const [business, setBusinessState] = useState('brew')

  // Read the real cookie after mount (SSR rendered 'brew').
  useEffect(() => {
    const v = readBusinessCookie()
    if (v !== business) setBusinessState(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setBusiness(value) {
    const v = value === 'surf' ? 'surf' : 'brew'
    setBusinessCookie(v)
    setBusinessState(v)
    router.refresh()
  }

  return (
    <BusinessContext.Provider value={{ business, setBusiness }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  return useContext(BusinessContext)
}
