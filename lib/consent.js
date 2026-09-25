// Cookie / analytics consent, client side.
//
// The rule: nothing optional (analytics, ad pixels, session replay) may load
// until the visitor has said yes in the cookie banner. Any future tracking
// script goes through <GatedAnalytics> in app/(external)/_components/legal/
// CookieConsent.jsx, or checks hasAnalyticsConsent() itself. Never drop a
// <script> tag for a tracker straight into a layout.
//
// Stored in localStorage (first party, never sent to a server). Missing,
// blocked or unreadable storage counts as "no".

export const CONSENT_KEY = 'bl_cookie_consent'
export const CONSENT_EVENT = 'bl-consent-change'
export const OPEN_SETTINGS_EVENT = 'bl-open-cookie-settings'

// Analytics is only "configured" when a measurement id is set in env. With no
// id there is nothing optional on the site, so the banner stays hidden rather
// than asking people to consent to nothing.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''
export const ANALYTICS_CONFIGURED = !!GA_MEASUREMENT_ID

export function getConsent() {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export function hasAnalyticsConsent() {
  return getConsent() === 'granted'
}

export function setConsent(value) {
  const v = value === 'granted' ? 'granted' : 'denied'
  try { window.localStorage.setItem(CONSENT_KEY, v) } catch {}
  try { window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v })) } catch {}
}

export function openCookieSettings() {
  try { window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT)) } catch {}
}
