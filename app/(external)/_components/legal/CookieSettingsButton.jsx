'use client'

import { ANALYTICS_CONFIGURED, openCookieSettings } from '@/lib/consent'

// "Cookie settings" control. Reopens the banner when there is something to
// choose; otherwise says plainly that nothing optional is running.
export default function CookieSettingsButton({ variant = 'button', style }) {
  if (!ANALYTICS_CONFIGURED) {
    if (variant === 'link') return null
    return (
      <p style={{ color: '#b8b8bf', fontSize: 15.5, lineHeight: 1.7, margin: '0 0 14px', ...style }}>
        Right now no optional cookies are in use, so there is nothing to switch on or off.
      </p>
    )
  }
  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={openCookieSettings}
        style={{
          background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit',
          letterSpacing: 'inherit', cursor: 'pointer', textDecoration: 'none', ...style,
        }}
      >
        Cookie settings
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      style={{
        padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700,
        background: 'transparent', color: '#f5f5f7', border: '1.5px solid #d4a333',
        cursor: 'pointer', margin: '0 0 14px', ...style,
      }}
    >
      Cookie settings
    </button>
  )
}
