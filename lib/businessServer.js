// Server-only resolver for the active staff business (Brew vs Surf City).
//
// Reads the same `business` cookie that lib/business.js writes on the client.
// Server /admin pages call this to scope their queries; defaults to 'brew' so
// any request without the cookie behaves exactly as it did before the switcher.

import { cookies } from 'next/headers'

export async function getActiveBusiness() {
  const store = await cookies()
  return store.get('business')?.value === 'surf' ? 'surf' : 'brew'
}
