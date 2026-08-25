// The Instagram + Facebook buttons, in one place.
//
// The footer had its own copy of these two SVGs and its own button styling, so
// putting the same links anywhere else meant a second copy that would drift.
// Both surfaces render this now.
//
// URLs come from ./nav SOCIALS — the same constant the structured data feeds
// its `sameAs` from, so the profiles Google is told are ours and the profiles a
// rider can actually click can never disagree.
//
// Presentational, no hooks, so it works inside the client RiderChrome tree and
// in a server-rendered page alike.

import { SOCIALS } from './nav'
import {
  INK_DIM, GOLD_HI, GOLD_INK, LINE, ON_PAPER_DIM, PAPER_LINE_HI,
} from '@/lib/marketingTheme'

export default function SocialLinks({ tone = 'dark', size = 38 }) {
  const paper = tone === 'paper'
  const cls = paper ? 'bl-social bl-social-paper' : 'bl-social'
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <SocialIcon href={SOCIALS.instagram} label="Jville Brew Loop on Instagram" kind="instagram" paper={paper} size={size} cls={cls} />
      <SocialIcon href={SOCIALS.facebook} label="Jville Brew Loop on Facebook" kind="facebook" paper={paper} size={size} cls={cls} />
      <style>{`
        .bl-social { transition: color .25s, border-color .25s, transform .25s; }
        .bl-social:hover { color: ${GOLD_HI}; border-color: rgba(212,163,51,0.5); transform: translateY(-2px); }
        /* GOLD_HI is a highlight against black and washes out on cream, so the
           light variant hovers to the text-weight gold instead. */
        .bl-social-paper:hover { color: ${GOLD_INK}; border-color: rgba(212,163,51,0.85); }
      `}</style>
    </div>
  )
}

function SocialIcon({ href, label, kind, paper, size, cls }) {
  const icon = Math.round(size * 0.47)
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: Math.round(size * 0.26),
        border: `1px solid ${paper ? PAPER_LINE_HI : LINE}`,
        color: paper ? ON_PAPER_DIM : INK_DIM,
        textDecoration: 'none',
      }}
    >
      {kind === 'instagram' ? (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1z" />
        </svg>
      )}
    </a>
  )
}
