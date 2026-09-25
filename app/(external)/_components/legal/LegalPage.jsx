// Shared shell for the policy pages (/privacy, /terms, /refunds, /cookies,
// /privacy/request). Plain server component: long-form text on the graphite
// site background, AA contrast throughout, real headings for screen readers
// and a "last updated" line pulled from lib/legal.js.

import Link from 'next/link'
import { LEGAL, LEGAL_LINKS, effectiveDate, mailingAddress } from '@/lib/legal'
import { BG, GOLD_HI, INK, INK_DIM, LINE, MAX_W_NARROW } from '@/lib/marketingTheme'

export default function LegalPage({ title, intro, children, current }) {
  return (
    <main className="site-main" style={{ background: BG }}>
      <div style={{ maxWidth: MAX_W_NARROW, margin: '0 auto', padding: 'clamp(40px, 6vw, 72px) 20px 72px' }}>
        <nav aria-label="Policies" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginBottom: 28 }}>
          {LEGAL_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current === l.href ? 'page' : undefined}
              style={{
                color: current === l.href ? GOLD_HI : INK_DIM,
                fontSize: 13.5,
                fontWeight: current === l.href ? 800 : 600,
                textDecoration: current === l.href ? 'underline' : 'none',
                padding: '6px 0',
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <h1 style={{ color: INK, fontSize: 'clamp(30px, 4.4vw, 42px)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
          {title}
        </h1>
        <p style={{ color: INK_DIM, fontSize: 13.5, margin: '12px 0 0' }}>
          {LEGAL.entity} · Effective {effectiveDate()}
        </p>
        {intro && (
          <p style={{ ...p, fontSize: 17, color: INK, marginTop: 22 }}>{intro}</p>
        )}

        <div className="legal-body" style={{ marginTop: 26 }}>
          {children}
        </div>

        <ContactBlock />
      </div>

      <style>{`
        .legal-body a { color: ${GOLD_HI}; text-decoration: underline; }
        .legal-body h2 { scroll-margin-top: 96px; }
      `}</style>
    </main>
  )
}

export function H2({ id, children }) {
  return (
    <h2 id={id} style={{ color: INK, fontSize: 21, letterSpacing: '-0.01em', margin: '38px 0 10px', lineHeight: 1.25 }}>
      {children}
    </h2>
  )
}

export function P({ children }) {
  return <p style={p}>{children}</p>
}

export function UL({ children }) {
  return <ul style={{ ...p, paddingLeft: 22, display: 'grid', gap: 8 }}>{children}</ul>
}

export function ContactBlock() {
  return (
    <section aria-labelledby="legal-contact" style={{ marginTop: 44, paddingTop: 22, borderTop: `1px solid ${LINE}` }}>
      <h2 id="legal-contact" style={{ color: INK, fontSize: 17, margin: '0 0 8px' }}>Contact us</h2>
      <p style={{ ...p, margin: 0 }}>
        {LEGAL.entity}<br />
        {mailingAddress()}<br />
        Email: <a href={`mailto:${LEGAL.email}`} style={{ color: GOLD_HI }}>{LEGAL.email}</a><br />
        Phone: <a href={`tel:${LEGAL.phone}`} style={{ color: GOLD_HI }}>{LEGAL.phoneDisplay}</a>
      </p>
    </section>
  )
}

const p = { color: INK_DIM, fontSize: 15.5, lineHeight: 1.7, margin: '0 0 14px' }
