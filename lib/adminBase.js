// URL base for a staff console: Brew lives at /admin, Surf City at /surf,
// Marines ("The Loop") at /loop. All consoles reuse the same HUD components;
// internal links call this so they stay inside the console you're in. Client
// comps get `business` from useBusiness(); server pages from getActiveBusiness().
export function adminBase(business) {
  if (business === 'surf') return '/surf'
  if (business === 'marines') return '/loop'
  return '/admin'
}
