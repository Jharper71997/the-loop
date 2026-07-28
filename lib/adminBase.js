import { isLoopSite } from './site'

// URL base for a staff console: Brew lives at /admin, Surf City at /surf,
// Marines ("The Loop") at /loop. All consoles reuse the same HUD components;
// internal links call this so they stay inside the console you're in. Client
// comps get `business` from useBusiness(); server pages from getActiveBusiness().
//
// On the standalone The Loop site the console is the only one on the domain, so
// it is served at /admin (middleware rewrites that onto the /loop tree). Links
// must render the public spelling or every click would 404.
export function adminBase(business) {
  if (isLoopSite) return '/admin'
  if (business === 'surf') return '/surf'
  if (business === 'marines') return '/loop'
  return '/admin'
}
