'use client'

// One consent checkbox for every rider form: booking, seat claim, Loop Pass,
// contact and the ride survey. Rules it exists to hold:
//  - it is controlled by the caller, and callers start it UNCHECKED
//  - the whole label is the hit target, and the native checkbox keeps its
//    keyboard behaviour and focus ring
//  - `tone` only changes colours (dark rider pages vs the light survey page)

import { smsConsentText, smsMarketingConsentText } from '@/lib/legal'

const TONES = {
  dark: { text: '#c4c4cb', link: '#f0c24a', accent: '#d4a333' },
  light: { text: '#4d4f55', link: '#8a6510', accent: '#d4a333' },
}

export default function ConsentCheckbox({ checked, onChange, children, tone = 'dark', id, required = false, fontSize = 13 }) {
  const t = TONES[tone] || TONES.dark
  return (
    <label
      htmlFor={id}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', color: t.text, fontSize, lineHeight: 1.5 }}
    >
      <input
        id={id}
        type="checkbox"
        checked={!!checked}
        required={required}
        aria-required={required || undefined}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 18, height: 18, marginTop: 2, flex: '0 0 18px', accentColor: t.accent, cursor: 'pointer' }}
      />
      <span>{children}</span>
    </label>
  )
}

// Inline links to the policies. Open in a new tab so reading them never
// throws away a half-filled form.
export function PolicyLink({ href, children, tone = 'dark' }) {
  const t = TONES[tone] || TONES.dark
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: t.link, textDecoration: 'underline' }}>
      {children}
    </a>
  )
}

export function SmsConsentLabel({ marketing = false, tone = 'dark', brand }) {
  return (
    <>
      {marketing ? smsMarketingConsentText(brand) : smsConsentText(brand)}{' '}
      See our <PolicyLink href="/terms#sms" tone={tone}>SMS terms</PolicyLink> and{' '}
      <PolicyLink href="/privacy" tone={tone}>Privacy Policy</PolicyLink>.
    </>
  )
}
