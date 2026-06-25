// Per-business config keyed by `kind` (groups.kind / events.kind).
//
// One source of truth for the three bar-shuttle businesses that share the
// the-loop engine: Jville Brew Loop ('brew'), the Camp Lejeune Loop
// ('marines'), and Surf City Loop ('surf'). Use brandFor(kind) instead of
// scattering `kind === 'marines' ? X : Y` ternaries through sms / email /
// booking — adding a fourth business should mean one entry here, not a grep.
//
// Fields:
//   brand        full display name (emails)            e.g. "Surf City Loop"
//   shortBrand   short display name (SMS, headers)     e.g. "Surf City"
//   rideName     fits "you're on ___ Saturday"         e.g. "the Surf City Loop"
//   basePath     URL prefix for the rider surface      e.g. "/surfcity" ('' for brew)
//   ticketPath / myTicketsPath / trackPath  rider links (absolute paths)
//   barsBusiness which `bars.business` rows belong to this loop (null = no bars)
//   *Env         env var NAMES (not values) for per-business sender / gate codes

export const BUSINESS = {
  brew: {
    kind: 'brew',
    brand: 'Jville Brew Loop',
    shortBrand: 'Brew Loop',
    badge: 'JBL',
    rideName: 'the Brew Loop',
    basePath: '',
    ticketPath: '/tickets/',
    myTicketsPath: '/my-tickets',
    trackPath: '/track',
    barsBusiness: 'brew',
    emailFromEnv: 'EMAIL_FROM',
    smsPhoneEnv: 'SIMPLETEXTING_PHONE',
    adminCodeEnv: null,
    driverCodeEnv: null,
  },
  marines: {
    kind: 'marines',
    brand: 'The Loop',
    shortBrand: 'The Loop',
    badge: 'TL',
    rideName: 'The Loop',
    basePath: '/marines',
    ticketPath: '/marines/tickets/',
    myTicketsPath: '/marines/my-tickets',
    trackPath: '/marines/track',
    barsBusiness: null, // Marines stops are inline-coord, not partner bars
    emailFromEnv: 'EMAIL_FROM',
    smsPhoneEnv: 'SIMPLETEXTING_PHONE',
    adminCodeEnv: 'LOOP_ADMIN_CODE',
    driverCodeEnv: 'LOOP_DRIVER_CODE',
  },
  surf: {
    kind: 'surf',
    brand: 'Surf City Loop',
    shortBrand: 'Surf City',
    badge: 'SCL',
    rideName: 'the Surf City Loop',
    basePath: '/surfcity',
    ticketPath: '/surfcity/tickets/',
    myTicketsPath: '/surfcity/my-tickets',
    trackPath: '/surfcity/track',
    barsBusiness: 'surf',
    emailFromEnv: 'SURF_EMAIL_FROM',
    smsPhoneEnv: 'SURF_SIMPLETEXTING_PHONE',
    adminCodeEnv: 'SURF_ADMIN_CODE',
    driverCodeEnv: 'SURF_DRIVER_CODE',
  },
}

// Resolve a business config from a kind, defaulting to Brew Loop so any
// untagged/legacy row keeps its current behavior.
export function brandFor(kind) {
  return BUSINESS[kind] || BUSINESS.brew
}

// Per-business email From address, falling back to the shared EMAIL_FROM, then
// a safe default. Keep env reads here so callers don't special-case businesses.
export function emailFromFor(kind) {
  const cfg = brandFor(kind)
  return (
    (cfg.emailFromEnv && process.env[cfg.emailFromEnv]) ||
    process.env.EMAIL_FROM ||
    `${cfg.brand} <onboarding@resend.dev>`
  )
}

// Per-business SMS sending number, falling back to the shared one (undefined =
// let SimpleTexting pick the account default).
export function smsPhoneFor(kind) {
  const cfg = brandFor(kind)
  return (
    (cfg.smsPhoneEnv && process.env[cfg.smsPhoneEnv]) ||
    process.env.SIMPLETEXTING_PHONE ||
    undefined
  )
}

// Client-safe: which business a rider pathname belongs to. The Surf surface is
// the only prefixed rider site today; anything else is Brew. (Marines rides the
// (loop) chrome, not the (external) chrome, so it never hits this helper.)
export function businessFromPath(pathname) {
  return String(pathname || '').startsWith('/surfcity') ? 'surf' : 'brew'
}

// Client-safe: prefix a rider link for a business. prefixLink('/track','surf')
// => '/surfcity/track'; prefixLink('/','surf') => '/surfcity'. Brew (basePath
// '') passes through unchanged, so shared components stay correct at '/'.
export function prefixLink(href, kind) {
  const base = brandFor(kind).basePath
  if (!base) return href
  if (href === '/') return base
  return base + href
}
