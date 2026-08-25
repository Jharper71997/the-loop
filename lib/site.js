// Which business THIS DEPLOYMENT serves.
//
// One codebase, two Vercel projects, one database. The same repo boots in
// either of two modes depending on NEXT_PUBLIC_SITE:
//
//   'brew' (default) — the original combined host. Brew rides at /, Surf City
//                      at /surfcity, The Loop at /marines; staff consoles at
//                      /admin, /surf, /loop. This is exactly today's behavior,
//                      so the live Brew site is unaffected by this file.
//
//   'marines'        — a standalone site for The Loop only. The rider surface
//                      owns the root (/, /events, /book, /track) and staff use
//                      /admin. Brew and Surf City surfaces are hidden entirely.
//
// The page FILES do not move: middleware maps the public URL onto the existing
// /marines and /loop trees. That keeps one set of components for all three
// businesses instead of forking the app per site.
//
// Read this instead of process.env directly so there is one spelling of the
// check. NEXT_PUBLIC_ so client components can branch on it too.

export const SITE = process.env.NEXT_PUBLIC_SITE === 'marines' ? 'marines' : 'brew'

// True when this deployment is the standalone The Loop site.
export const isLoopSite = SITE === 'marines'

// True on the combined Brew deployment, which still serves all three businesses
// at their prefixes.
export const isCombinedSite = SITE === 'brew'
