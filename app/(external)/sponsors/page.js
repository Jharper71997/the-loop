import Link from 'next/link'
import { CONTACT } from '../_components/site/nav'
import SponsorGrid from './SponsorGrid'
import {
  GOLD_HI, INK, INK_DIM, MAX_W,
  primaryCta, ghostCta, eyebrow, softCard, stepNum, pulseDot, HERO_GLOW, GOLD_WASH,
} from '@/lib/marketingTheme'

export const metadata = {
  title: 'Sponsors & Partners',
  description:
    'Put your brand in front of the Jville Brew Loop. Sponsor a weekend, host a pickup, or become a featured partner for the Friday and Saturday night bar-hop crowd in Jacksonville.',
  alternates: { canonical: '/sponsors' },
  openGraph: {
    title: 'Sponsor the Jville Brew Loop',
    description: 'Get your brand in front of Jacksonville’s weekend bar-hop crowd. Sponsor a weekend, host a pickup, or become a featured partner.',
    url: '/sponsors',
  },
}

const WAYS = [
  { title: 'Sponsor a weekend', sub: 'Get named as the sponsor of a Friday or Saturday night, with a shout in the rider texts that go out to everyone riding that weekend.' },
  { title: 'Host a pickup', sub: 'Make your spot a Loop pickup point. Riders start their night at your door before they hop the route.' },
  { title: 'Become a featured partner', sub: 'Your logo and link featured on the Loop site all season, so riders discover you before and after the night out.' },
]

const AUDIENCE = [
  { stat: '21+', label: 'Every rider, verified age' },
  { stat: 'Fri + Sat', label: 'Weekend nights, all season' },
  { stat: '8 bars', label: 'A rotating Jacksonville route' },
]

export default function SponsorsPage() {
  return (
    <main className="site-main">
      {/* Hero */}
      <section style={{ position: 'relative', padding: 'clamp(44px, 8vw, 80px) 16px clamp(28px, 5vw, 44px)' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: HERO_GLOW, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto' }}>
          <div style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span style={pulseDot} /> Partners &amp; sponsors
          </div>
          <h1 style={{ color: INK, fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.06, margin: '14px 0 0' }}>
            Put your brand in front of<br /><span style={{ color: GOLD_HI }}>a full shuttle every weekend.</span>
          </h1>
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2.2vw, 18px)', lineHeight: 1.55, margin: '16px 0 0', maxWidth: 580 }}>
            The Brew Loop carries a full shuttle of people already out in Jacksonville every Friday and Saturday.
            Bars, breweries, and local businesses ride with us. Here&rsquo;s how you can too.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
            <a href={`mailto:${CONTACT.partnerEmail}?subject=Brew%20Loop%20partner%20pack`} style={primaryCta}>Get the partner pack</a>
            <Link href="/track" style={ghostCta}>See the shuttle live</Link>
          </div>
        </div>
      </section>

      {/* Audience strip */}
      <section style={{ maxWidth: MAX_W, margin: '0 auto', padding: '8px 16px' }}>
        <div style={{ ...softCard, padding: '20px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', textAlign: 'center' }}>
          {AUDIENCE.map(a => (
            <div key={a.label}>
              <div style={{ color: GOLD_HI, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800 }}>{a.stat}</div>
              <div style={{ color: INK_DIM, fontSize: 13.5, marginTop: 4 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Current sponsors */}
      <section style={{ maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(40px, 6vw, 64px) 16px 8px' }}>
        <div style={{ maxWidth: 620 }}>
          <div style={eyebrow}>Who rides with us</div>
          <h2 style={{ color: INK, fontSize: 'clamp(24px, 4.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.015em', margin: '12px 0 0' }}>
            The businesses backing the Loop.
          </h2>
          <p style={{ color: INK_DIM, fontSize: 15.5, lineHeight: 1.55, margin: '12px 0 0' }}>
            Local shops, spots, and services already ride with us every weekend. Tap any to check them out.
          </p>
        </div>
        <SponsorGrid />
      </section>

      {/* Ways to partner */}
      <section style={{ maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(40px, 6vw, 64px) 16px' }}>
        <div style={{ maxWidth: 620 }}>
          <div style={eyebrow}>Ways to partner</div>
          <h2 style={{ color: INK, fontSize: 'clamp(24px, 4.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.015em', margin: '12px 0 0' }}>
            Ways to ride with the Loop.
          </h2>
        </div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 32 }}>
          {WAYS.map((w, i) => (
            <div key={w.title} style={{ ...softCard, padding: '24px 22px' }}>
              <span style={stepNum}>{String(i + 1).padStart(2, '0')}</span>
              <div style={{ color: INK, fontSize: 18, fontWeight: 800, marginTop: 16 }}>{w.title}</div>
              <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: '8px 0 0' }}>{w.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section style={{ maxWidth: MAX_W, margin: '0 auto', padding: '0 16px clamp(48px, 7vw, 76px)' }}>
        <div style={{ ...softCard, padding: 'clamp(32px, 6vw, 56px) 24px', textAlign: 'center', border: `1px solid rgba(212,163,51,0.28)`, background: `linear-gradient(180deg, ${GOLD_WASH}, transparent)` }}>
          <h2 style={{ color: INK, fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, margin: 0 }}>Let&rsquo;s find your fit.</h2>
          <p style={{ color: INK_DIM, fontSize: 15.5, lineHeight: 1.55, margin: '12px auto 0', maxWidth: 520 }}>
            Tell us a little about your business and we&rsquo;ll send the partner pack with the weekends and packages that make sense.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
            <a href={`mailto:${CONTACT.partnerEmail}?subject=Brew%20Loop%20partner%20pack`} style={primaryCta}>Email {CONTACT.partnerEmail}</a>
            <a href={`tel:${CONTACT.phone}`} style={ghostCta}>Call {CONTACT.phoneDisplay}</a>
          </div>
        </div>
      </section>
    </main>
  )
}
