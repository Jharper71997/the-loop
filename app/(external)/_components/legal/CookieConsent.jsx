'use client'

// Cookie banner + the only sanctioned place to load analytics.
//
// - Hidden entirely while no analytics id is configured (there is nothing
//   optional to consent to). Set NEXT_PUBLIC_GA_MEASUREMENT_ID and it appears.
// - "Allow analytics" and "No thanks" are the same size and weight. Declining
//   is one tap and is remembered; so is allowing. No pre-ticked toggles.
// - The footer "Cookie settings" link and the /cookies page reopen it.
// - GatedAnalytics renders the GA tag only after an explicit yes.

import { useEffect, useState, useSyncExternalStore } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import {
  ANALYTICS_CONFIGURED, GA_MEASUREMENT_ID, CONSENT_EVENT, OPEN_SETTINGS_EVENT,
  getConsent, setConsent,
} from '@/lib/consent'

export default function CookieConsent() {
  // 'ssr' on the server and during hydration, then the stored choice
  // (null = not answered yet). Re-reads whenever the choice changes here or in
  // another tab.
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => 'ssr')
  const ready = consent !== 'ssr'
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen)
  }, [])

  if (!ANALYTICS_CONFIGURED) return null

  const choose = v => {
    setConsent(v)
    setOpen(false)
  }

  const showBanner = ready && (open || consent === null)

  return (
    <>
      {consent === 'granted' && <GatedAnalytics />}
      {showBanner && (
        <section
          role="region"
          aria-label="Cookie choices"
          style={{
            position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))',
            zIndex: 60, maxWidth: 560, margin: '0 auto',
            background: '#1e1e22', color: '#f5f5f7',
            border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14,
            padding: '16px 18px', boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#d6d6dc' }}>
            We would like to use analytics cookies to see which pages help people find the shuttle. They only load if you say yes.
            Everything the site needs to work runs either way. <Link href="/cookies" style={{ color: '#f0c24a', textDecoration: 'underline' }}>Cookie Policy</Link>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <button type="button" onClick={() => choose('denied')} style={btn}>No thanks</button>
            <button type="button" onClick={() => choose('granted')} style={btn}>Allow analytics</button>
          </div>
          {ready && consent && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#a6a6ae' }}>
              Current choice: {consent === 'granted' ? 'analytics allowed' : 'analytics off'}.
            </p>
          )}
        </section>
      )}
    </>
  )
}

function subscribeConsent(cb) {
  window.addEventListener(CONSENT_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(CONSENT_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

// Loaded only after consent. IP anonymisation is on; ad personalisation
// signals are off.
function GatedAnalytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}
      </Script>
    </>
  )
}

const btn = {
  padding: '12px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, letterSpacing: 0,
  background: 'transparent', color: '#f5f5f7', border: '1.5px solid #d4a333', cursor: 'pointer',
}
