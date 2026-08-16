// The staff console, as five questions instead of twenty-eight pages.
//
// Before this, the Loop had two staff surfaces in two different design systems:
// /admin (7 links, one look) and /leadership (19 pages, five tabs with
// dropdowns, another look). Finding anything meant knowing which of the two it
// lived in first.
//
// Now the sidebar carries five entries, each named for a question the business
// actually runs on:
//
//   Tonight — what is running, who is driving, who is on the list
//   Riders  — who rode, who might again, and what they said
//   Bars    — the route and the partners on it
//   Money   — what came in and what went out
//   Setup   — the things you change twice a year
//
// Nothing moved. Every page that used to be its own sidebar link keeps its own
// route and shows up as a tab inside the section it belongs to, so every
// bookmark, email link, and bit of muscle memory still lands.
//
// Gating flags on a tab (leadership / security / driver) hide it from staff who
// can't use it. The section itself disappears when none of its tabs survive
// filtering, so a driver signing in sees a two-entry sidebar, not five entries
// with four dead ends.

export const SECTIONS = [
  {
    key: 'tonight',
    href: '/admin',
    label: 'Tonight',
    exact: true,
    icon: 'bus',
    match: ['/admin/groups', '/admin/driver', '/admin/security', '/admin/schedule', '/leadership/loops', '/leadership/drivers', '/leadership/schedule'],
    tabs: [
      { href: '/admin', label: 'Schedule', exact: true },
      { href: '/admin/groups', label: 'Loops' },
      { href: '/admin/schedule', label: 'Crew' },
      { href: '/admin/security', label: 'Security', security: true },
      { href: '/admin/driver', label: 'Driver view', driver: true },
      { href: '/leadership/loops', label: 'Loop P&L', leadership: true },
      { href: '/leadership/schedule', label: 'Season', leadership: true },
      { href: '/leadership/drivers', label: 'Drivers', leadership: true },
      { href: '/leadership/drivers/route-log', label: 'Route log', leadership: true },
    ],
  },
  {
    key: 'riders',
    href: '/admin/contacts',
    label: 'Riders',
    icon: 'people',
    match: ['/leadership/ridership', '/leadership/feedback', '/leadership/leaderboard', '/leadership/referrals', '/leadership/passes'],
    tabs: [
      { href: '/admin/contacts', label: 'Contacts' },
      { href: '/leadership/ridership', label: 'Ridership', leadership: true },
      { href: '/leadership/feedback', label: 'Feedback', leadership: true },
      { href: '/leadership/leaderboard', label: 'Leaderboard', leadership: true },
      { href: '/leadership/referrals', label: 'Referrals', leadership: true },
      { href: '/leadership/passes', label: 'Loop Pass', leadership: true },
    ],
  },
  {
    key: 'bars',
    href: '/leadership/bars',
    label: 'Bars',
    icon: 'pin',
    leadership: true,
    match: ['/leadership/sponsors', '/leadership/comps'],
    tabs: [
      { href: '/leadership/bars', label: 'Bars', leadership: true },
      { href: '/leadership/sponsors', label: 'Sponsors', leadership: true },
      { href: '/leadership/comps', label: 'Comps', leadership: true },
    ],
  },
  {
    key: 'money',
    href: '/leadership/income',
    label: 'Money',
    icon: 'dollar',
    leadership: true,
    match: ['/leadership/expenses', '/leadership/cash', '/leadership/profit-first', '/admin/finance'],
    tabs: [
      { href: '/leadership/income', label: 'Overview', leadership: true },
      { href: '/leadership/expenses', label: 'Expenses', leadership: true },
      { href: '/leadership/cash', label: 'Cash', leadership: true },
      { href: '/leadership/profit-first', label: 'Profit First', leadership: true },
      { href: '/admin/finance', label: 'Entries', leadership: true },
    ],
  },
  {
    key: 'setup',
    href: '/leadership/automations',
    label: 'Setup',
    icon: 'gear',
    leadership: true,
    match: ['/leadership/alerts', '/leadership/attribution'],
    tabs: [
      { href: '/leadership/automations', label: 'Automations', leadership: true },
      { href: '/leadership/alerts', label: 'Alerts', leadership: true },
      { href: '/leadership/attribution', label: 'Flyer tracking', leadership: true },
    ],
  },
]

// A route belongs to the section that claims it, either as its own href or in
// its match list. Longest match wins so /admin (a prefix of everything) never
// steals a route another section owns.
export function sectionForPath(pathname) {
  if (!pathname) return null
  let best = null
  let bestLen = -1
  for (const s of SECTIONS) {
    const candidates = [s.exact ? null : s.href, ...(s.match || [])].filter(Boolean)
    for (const c of candidates) {
      if ((pathname === c || pathname.startsWith(c + '/')) && c.length > bestLen) {
        best = s
        bestLen = c.length
      }
    }
    if (s.exact && pathname === s.href && bestLen < 0) {
      best = s
      bestLen = 0
    }
  }
  return best
}

export function visibleTabs(section, roles) {
  if (!section) return []
  return section.tabs.filter(t => allowed(t, roles))
}

export function visibleSections(roles) {
  return SECTIONS
    .filter(s => allowed(s, roles))
    .map(s => ({ ...s, tabs: visibleTabs(s, roles) }))
    .filter(s => s.tabs.length > 0)
}

function allowed(entry, roles = {}) {
  if (entry.leadership && !roles.isLeader) return false
  if (entry.security && !(roles.isSec || roles.isLeader)) return false
  if (entry.driver && !(roles.isDrv || roles.isLeader)) return false
  return true
}
