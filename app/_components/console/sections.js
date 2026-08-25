// The staff console, as the six things that run a weekend.
//
// This used to be five sections with twenty-eight tabs hanging off them. Every
// page in the building had a link, so the four screens a crew actually touches
// on a Friday night were buried among Profit First, flyer tracking and season
// planning. Two rows of navigation, thirty destinations, one bus to load.
//
// Now the sidebar is a flat list with no tab row under it, and each entry is a
// job someone does on the night:
//
//   Tonight — what is running right now
//   Loops   — the nights themselves: tickets, waivers, route
//   Crew    — who is working
//   Door    — scanning riders in            (security)
//   Driver  — the screen in the bus         (driver)
//   Riders  — look somebody up, text them
//
// Everything else — money, bars, sponsors, season, automations, all of it — is
// one entry, Back office, and only leadership sees it. Nothing was deleted and
// no URL moved: /leadership/* all still resolve, they are just reached from the
// back office index instead of shouting at the crew from the sidebar.
//
// Role flags hide what a person can't use, so a driver signing in gets a
// two-entry console instead of six entries and four dead ends.

export const SECTIONS = [
  {
    key: 'tonight',
    href: '/admin',
    label: 'Tonight',
    exact: true,
    icon: 'bus',
    blurb: 'Who is riding',
  },
  {
    key: 'loops',
    href: '/admin/groups',
    label: 'Loops',
    icon: 'ticket',
    blurb: 'Nights + tickets',
  },
  {
    key: 'crew',
    href: '/admin/schedule',
    label: 'Crew',
    icon: 'people',
    blurb: 'Who is working',
  },
  {
    key: 'door',
    href: '/admin/security',
    label: 'Door',
    icon: 'scan',
    security: true,
    blurb: 'Scan them in',
  },
  {
    key: 'driver',
    href: '/admin/driver',
    label: 'Driver',
    icon: 'wheel',
    driver: true,
    blurb: 'The bus screen',
  },
  {
    key: 'riders',
    href: '/admin/contacts',
    label: 'Riders',
    icon: 'search',
    blurb: 'Look someone up',
  },
  {
    key: 'office',
    href: '/leadership',
    label: 'Back office',
    icon: 'gear',
    leadership: true,
    blurb: 'Money + everything else',
    match: ['/leadership', '/admin/finance'],
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

export function visibleSections(roles) {
  return SECTIONS.filter(s => allowed(s, roles))
}

function allowed(entry, roles = {}) {
  if (entry.leadership && !roles.isLeader) return false
  if (entry.security && !(roles.isSec || roles.isLeader)) return false
  if (entry.driver && !(roles.isDrv || roles.isLeader)) return false
  return true
}
