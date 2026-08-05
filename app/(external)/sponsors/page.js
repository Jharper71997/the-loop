import Link from 'next/link'
import { PARTNER_BAR_COUNT } from '@/lib/bars'
import { CONTACT } from '../_components/site/nav'
import SponsorGrid from './SponsorGrid'
import { PageHero, Band, Head, Closer } from '../_components/marketing/PageShell'
import {
  GOLD_HI, INK, INK_DIM, INK_MUTE,
  primaryCtaLg, ghostCta,
} from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'

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
  {
    n: '01',
    title: 'Sponsor a weekend',
    sub: 'Get named as the sponsor of a Friday or Saturday night, with a shout in the rider texts that go out to everyone riding that weekend.',
  },
  {
    n: '02',
    title: 'Host a pickup',
    sub: 'Make your spot a Loop pickup point. Riders start their night at your door before they hop the route.',
  },
  {
    n: '03',
    title: 'Become a featured partner',
    sub: 'Your logo and link featured on the Loop site all season, so riders discover you before and after the night out.',
  },
]

const AUDIENCE = [
  { stat: '21+', label: 'Every rider, age verified' },
  { stat: 'Fri + Sat', label: 'Weekend nights, all season' },
  { stat: `${PARTNER_BAR_COUNT} bars`, label: 'A rotating Jacksonville route' },
  { stat: 'Screens', label: 'On board, running the whole route' },
]

export default function SponsorsPage() {
  return (
    <main className="site-main">
      <PageHero
        image="/brand/photos/sponsors-hero.jpg"
        position="center 40%"
        kicker={'Partners & sponsors'}
        title={<>Your brand rides<br /><span style={{ color: GOLD_HI }}>every weekend.</span></>}
        sub="The Brew Loop carries a bus of people already out in Jacksonville every Friday and Saturday, with screens running the whole route. Bars, breweries, and local businesses ride with us."
        actions={
          <>
            <Link href="/contact?topic=sponsor" style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>Get the partner pack</Link>
            <a href={`tel:${CONTACT.phone}`} style={{ ...ghostCta, padding: '16px 24px', fontSize: 15 }}>Call {CONTACT.phoneDisplay}</a>
          </>
        }
      />

      {/* Audience — a thin strip, matching /about's facts band */}
      <Band tone="raised" tight>
        <div style={{ display: 'grid', gap: 'clamp(18px, 3vw, 40px)', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {AUDIENCE.map(a => (
            <div key={a.label}>
              <div style={{ color: GOLD_HI, fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{a.stat}</div>
              <div style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.45, marginTop: 9 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </Band>

      {/* Ways to partner */}
      <Band tone="base" light="top-right" strength={0.14} grain rule>
        <Head
          kicker="Ways to partner"
          title="Three ways to ride with the Loop."
          sub="Pick the one that fits, or tell us what you’re trying to reach and we’ll point you at the right one."
        />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', marginTop: 38 }}>
          {WAYS.map(w => (
            <div key={w.title} style={litCard({ radius: 18 })}>
              <div style={litCardInner({ radius: 17, pad: 26 })}>
                <span style={stepBadge}>{w.n}</span>
                <div style={{ color: INK, fontSize: 18, fontWeight: 800, marginTop: 18, letterSpacing: '-0.01em' }}>{w.title}</div>
                <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.62, margin: '10px 0 0' }}>{w.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </Band>

      {/* Who already rides */}
      <Band tone="void" light="left" strength={0.1} rule>
        <Head
          kicker="Who rides with us"
          title="The businesses backing the Loop."
          sub="Local shops, spots, and services already ride with us every weekend. Tap any to check them out."
        />
        <SponsorGrid />
      </Band>

      <Closer
        title={<>Let&rsquo;s find<br /><span style={{ color: GOLD_HI }}>your fit.</span></>}
        sub="Tell us a little about your business and we’ll send the partner pack with the weekends and packages that make sense."
        cta={{ href: '/contact?topic=sponsor', label: 'Request the partner pack' }}
        secondary={<a href={`tel:${CONTACT.phone}`} style={{ ...ghostCta, padding: '17px 26px', fontSize: 15 }}>Call {CONTACT.phoneDisplay}</a>}
      />

      <Band tone="base" tight>
        <p style={{ color: INK_MUTE, fontSize: 14, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
          Run a bar in Jacksonville instead?{' '}
          <Link href="/contact?topic=bar" style={{ color: GOLD_HI, fontWeight: 700, textDecoration: 'none' }}>
            Get your spot on the route &rarr;
          </Link>
        </p>
      </Band>
    </main>
  )
}

const stepBadge = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 42, height: 42, borderRadius: 13,
  border: '1px solid rgba(212,163,51,0.45)',
  background: 'linear-gradient(160deg, rgba(212,163,51,0.18), rgba(212,163,51,0.04))',
  color: GOLD_HI, fontSize: 14.5, fontWeight: 800,
}
