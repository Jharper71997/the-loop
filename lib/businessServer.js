// Server-only resolver for the active staff console's business.
//
// The staff consoles are separate URL trees: Brew at /admin, Surf at /surf,
// Marines ("The Loop") at /loop. Middleware tags each request with an
// `x-business` header based on the path; server pages read it here. Defaults to
// 'brew' so anything without the header behaves like the Brew console.

import { headers } from 'next/headers'

export async function getActiveBusiness() {
  const h = await headers()
  const b = h.get('x-business')
  return b === 'surf' ? 'surf' : b === 'marines' ? 'marines' : 'brew'
}
