// Server-only resolver for the active staff console's business.
//
// The staff consoles are separate URL trees: Brew at /admin, Surf at /surf,
// Marines ("The Loop") at /loop. Middleware tags each request with an
// `x-business` header based on the path; server pages read it here. Defaults to
// 'brew' so anything without the header behaves like the Brew console.

// On the standalone The Loop site (NEXT_PUBLIC_SITE=marines) the default flips
// to 'marines' — there is no Brew console on that deployment, so an untagged
// request should never fall back to Brew data.

import { headers } from 'next/headers'
import { SITE } from './site'

export async function getActiveBusiness() {
  const h = await headers()
  const b = h.get('x-business')
  return b === 'surf' ? 'surf' : b === 'marines' ? 'marines' : SITE
}
