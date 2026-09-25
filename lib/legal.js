// Single source of truth for the legal facts every policy page, the footer,
// the consent checkboxes and the email footers print. Plain module, no hooks,
// so server and client components can both import it.
//
// Anything in [SQUARE BRACKETS] is a fact we do not have yet. The policy pages
// render the placeholder visibly on purpose, so nobody can ship them without
// noticing. Fill these in before this branch goes to production.

export const LEGAL = {
  entity: 'Jville Brew Loop LLC',
  brand: 'Jville Brew Loop',
  state: 'North Carolina',
  city: 'Jacksonville, NC',
  // Mailing address for notices and privacy requests. Unknown as of the
  // compliance pass (2026-09-25). Empty string = not known yet.
  mailingAddress: '',
  mailingAddressPlaceholder: '[MAILING ADDRESS]',
  email: 'jacob@jvillebrewloop.com',
  phone: '+12197793677',
  phoneDisplay: '(219) 779-3677',
  // The number riders receive texts from (SimpleTexting).
  smsNumberDisplay: '(910) 412-7026',
  // Policy effective date. Set this the day the policies go live.
  effectiveDate: '',
  effectiveDatePlaceholder: '[EFFECTIVE DATE]',
  // Bump when the Terms change materially. Stored in Stripe metadata on every
  // booking and pass checkout so we can show which version someone agreed to.
  termsVersion: '2026-09-25',
  site: 'jvillebrewloop.com',
  riderMinAge: 21,
  buyerMinAge: 18,
}

export function mailingAddress() {
  return LEGAL.mailingAddress || LEGAL.mailingAddressPlaceholder
}

export function effectiveDate() {
  return LEGAL.effectiveDate || LEGAL.effectiveDatePlaceholder
}

export const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/privacy/request', label: 'Delete my data' },
]

// Express written consent language for texts (TCPA / CTIA). The checkbox that
// carries this must start UNCHECKED and must never be required to buy.
// Kept as one string so the exact wording someone agreed to is recoverable.
const SMS_FINE_PRINT =
  'Texts may be sent with automated technology. Consent is not a condition of purchase. ' +
  'Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.'

export const smsConsentText = (brand = 'Jville Brew Loop') =>
  'Yes, text me about my rides at the number above: booking confirmations, pickup reminders, ' +
  `live tracking links and ride-day updates from ${brand}. ${SMS_FINE_PRINT}`

// Marketing texts are a separate consent from ride texts.
export const smsMarketingConsentText = (brand = 'Jville Brew Loop') =>
  `Yes, text me when new ${brand} weekends go on sale. ${SMS_FINE_PRINT}`

// Short opt-out line appended to the first text of a booking.
export const SMS_OPT_OUT_LINE = 'Reply STOP to opt out.'
