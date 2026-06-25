// URL base for a staff console: Brew lives at /admin, Surf City at /surf. Both
// consoles reuse the same HUD components; internal links call this so they stay
// inside the console you're in. Client comps get `business` from useBusiness();
// server pages from getActiveBusiness().
export function adminBase(business) {
  return business === 'surf' ? '/surf' : '/admin'
}
