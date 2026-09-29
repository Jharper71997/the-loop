// Brew Loop marketing-website footer: brand, quick links, socials, contact,
// legal. Presentational (no hooks) so it works inside the client RiderChrome.

import Link from 'next/link'
import { brandFor } from '@/lib/businessConfig'
import { PRIMARY_CTA, CONTACT } from './nav'
import SocialLinks from './SocialLinks'
import { INK, INK_DIM, INK_MUTE, LINE } from '@/lib/marketingTheme'
import { LEGAL, LEGAL_LINKS } from '@/lib/legal'
import CookieSettingsButton from '../legal/CookieSettingsButton'

const cfg = brandFor('brew')
const YEAR = 2026 // Date.* is unavailable in some build contexts; bump yearly.

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${LINE}`, background: '#131316', marginTop: 0 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '44px 24px 28px' }}>
        <div style={{ display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {/* Brand + socials */}
          <div>
            <Link href="/" aria-label={`${cfg.brand} home`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/badge-gold.png" alt="Jville Brew Loop" style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }} />
              <span style={{ color: INK, fontSize: 15, fontWeight: 800 }}>{cfg.brand}</span>
            </Link>
            <p style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.6, margin: '14px 0 16px', maxWidth: 280 }}>
              Jacksonville&rsquo;s weekend bar-hop shuttle. Loop the best bars all night so nobody has to be the one who drives.
            </p>
            <SocialLinks />
          </div>

          {/* Two columns, no link in both: the website, then the app you use on
              the night. Deriving one of these from NAV_LINKS put Find My Bus,
              /events and /about in the footer twice. */}
          <FooterCol
            title="The Loop"
            links={[
              { href: '/about', label: 'How It Works' },
              { href: '/bars', label: 'Partner Bars' },
              { href: '/merch', label: 'Merch' },
              { href: '/sponsors', label: 'Sponsors' },
            ]}
          />

          <FooterCol
            title="Riders"
            links={[
              PRIMARY_CTA,
              { href: '/pass', label: 'Loop Pass' },
              { href: '/track', label: 'Find My Bus' },
              { href: '/my-tickets', label: 'My Tickets' },
            ]}
          />

          {/* Contact */}
          <div>
            <div style={colTitle}>Get in touch</div>
            <Link href="/contact" style={footerLink}>Contact us</Link>
            <a href={`mailto:${CONTACT.email}`} style={footerLink}>{CONTACT.email}</a>
            <a href={`tel:${CONTACT.phone}`} style={footerLink}>{CONTACT.phoneDisplay}</a>
            <div style={{ color: INK_MUTE, fontSize: 12.5, marginTop: 10 }}>{CONTACT.city} · 21+</div>
          </div>
        </div>

        {/* Legal row: policies, cookie choices, and the business details every
            policy page points back to. Addresses come from lib/legal.js. */}
        <nav aria-label="Legal" style={{ borderTop: `1px solid ${LINE}`, marginTop: 28, paddingTop: 16, display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
          {LEGAL_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={legalLink}>{l.label}</Link>
          ))}
          <Link href="/pass/manage" style={legalLink}>Cancel Loop Pass</Link>
          <CookieSettingsButton variant="link" style={legalLink} />
        </nav>

        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: INK_MUTE, fontSize: 12.5, lineHeight: 1.6 }}>
            © {YEAR} {LEGAL.entity} · {LEGAL.mailingAddress || LEGAL.city} · Riders {LEGAL.riderMinAge}+ with valid ID
          </span>
          <span style={{ color: INK_MUTE, fontSize: 12.5 }}>Never drive between bars.</span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div style={colTitle}>{title}</div>
      {links.map(l => (
        <Link key={l.href + l.label} href={l.href} style={footerLink}>{l.label}</Link>
      ))}
    </div>
  )
}

const colTitle = {
  color: INK, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', marginBottom: 12,
}
const legalLink = {
  color: INK_DIM, fontSize: 13, textDecoration: 'none', padding: '8px 0', lineHeight: 1.3,
}
const footerLink = {
  display: 'block', color: INK_DIM, fontSize: 14, textDecoration: 'none',
  padding: '13px 0', lineHeight: 1.3,
}
