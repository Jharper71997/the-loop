'use client'

// Shares the active console's business (Brew vs Surf City) with client pages in
// the staff HUD. The two consoles are separate URL trees (/admin = Brew, /surf =
// Surf), each layout fixes the value, so this is a constant per console — no
// toggle, no cookie. Server pages read the same business from the x-business
// header (see lib/businessServer).

import { createContext, useContext } from 'react'

const BusinessContext = createContext({ business: 'brew' })

export function BusinessProvider({ value = 'brew', children }) {
  return (
    <BusinessContext.Provider value={{ business: value === 'surf' ? 'surf' : 'brew' }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  return useContext(BusinessContext)
}
