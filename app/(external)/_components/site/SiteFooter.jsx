// Brew Loop marketing-website footer: brand, quick links, socials, contact,
// legal. Presentational (no hooks) so it works inside the client RiderChrome.

import Link from 'next/link'
import { brandFor } from '@/lib/businessConfig'
import { PRIMARY_CTA, CONTACT } from './nav'
import SocialLinks from './SocialLinks'
import { INK, INK_DIM, INK_MUTE, LINE } from '@/lib/marketingTheme'

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

        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 28, paddingTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: INK_MUTE, fontSize: 12.5 }}>© {YEAR} Jville Brew Loop LLC · Jacksonville, NC</span>
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
const footerLink = {
  display: 'block', color: INK_DIM, fontSize: 14, textDecoration: 'none',
  padding: '13px 0', lineHeight: 1.3,
}
