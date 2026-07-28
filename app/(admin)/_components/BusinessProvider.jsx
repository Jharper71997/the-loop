'use client'

// Shares the active console's business with client pages in the staff HUD. The
// consoles are separate URL trees (/admin = Brew, /surf = Surf, /loop = Marines),
// each layout fixes the value, so this is a constant per console — no toggle, no
// cookie. Server pages read the same business from the x-business header (see
// lib/businessServer).

import { createContext, useContext } from 'react'

const BusinessContext = createContext({ business: 'brew' })

export function BusinessProvider({ value = 'brew', children }) {
  const business = value === 'surf' ? 'surf' : value === 'marines' ? 'marines' : 'brew'
  return (
    <BusinessContext.Provider value={{ business }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  return useContext(BusinessContext)
}
