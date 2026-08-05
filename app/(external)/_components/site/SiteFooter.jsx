// Brew Loop marketing-website footer: brand, quick links, socials, contact,
// legal. Presentational (no hooks) so it works inside the client RiderChrome.

import Link from 'next/link'
import { brandFor } from '@/lib/businessConfig'
import { PRIMARY_CTA, SOCIALS, CONTACT } from './nav'
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
            <div style={{ display: 'flex', gap: 10 }}>
              <SocialIcon href={SOCIALS.instagram} label="Instagram" kind="instagram" />
              <SocialIcon href={SOCIALS.facebook} label="Facebook" kind="facebook" />
            </div>
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

function SocialIcon({ href, label, kind }) {
  return (
    <a href={href} aria-label={label} target="_blank" rel="noopener noreferrer" style={socialBtn}>
      {kind === 'instagram' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1z" />
        </svg>
      )}
    </a>
  )
}

const colTitle = {
  color: INK, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', marginBottom: 12,
}
const footerLink = {
  display: 'block', color: INK_DIM, fontSize: 14, textDecoration: 'none',
  padding: '6px 0', lineHeight: 1.3,
}
const socialBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 38, height: 38, borderRadius: 10, border: `1px solid ${LINE}`,
  color: INK_DIM, textDecoration: 'none',
}
