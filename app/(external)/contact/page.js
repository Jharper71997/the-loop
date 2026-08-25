import { Suspense } from 'react'
import Link from 'next/link'
import { CONTACT, SOCIALS } from '../_components/site/nav'
import ContactForm from './ContactForm'
import { PageHero, Band, Head } from '../_components/marketing/PageShell'
import {
  GOLD_HI, INK, INK_DIM, INK_MUTE, LINE,
} from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'
import { OG_IMAGES } from '@/lib/socialMeta'

export const metadata = {
  title: 'Contact',
  description:
    'Questions about riding the Jville Brew Loop, booking a group, sponsoring a weekend, or putting your bar on the route? Send us a message.',
  alternates: { canonical: '/contact' },
  openGraph: {
    images: OG_IMAGES,
    title: 'Contact the Jville Brew Loop',
    description: 'Riders, groups, sponsors, and partner bars — one inbox, real answers.',
    url: '/contact',
  },
}

// Fast answers that would otherwise become a message. Anything already answered
// on the site links there instead of restating it here.
const QUICK = [
  { q: 'Want a seat this weekend?', a: 'Booking takes about a minute and the waiver is built into checkout.', href: '/events', cta: 'See upcoming loops' },
  { q: 'Trying to find the shuttle?', a: 'The live tracker shows where the bus is and which stop it is heading to next.', href: '/track', cta: 'Find my bus' },
  { q: 'New to the Loop?', a: 'How a night actually runs, start to finish, including how you get to your first bar.', href: '/about', cta: 'How it works' },
]

export default function ContactPage() {
  return (
    <main className="site-main">
      <PageHero
        image="/brand/photos/contact-hero.jpg"
        position="center 22%"
        kicker="Get in touch"
        title={<>Ask us anything.<br /><span style={{ color: GOLD_HI }}>A person answers.</span></>}
        sub="Riders, groups, sponsors, and bars all reach the same inbox. Tell us what you need and we’ll come back with a straight answer, usually the same day."
      />

      {/* Form + direct lines */}
      <Band tone="raised" light="top-right" strength={0.12} grain>
        <div style={{ display: 'grid', gap: 'clamp(20px, 3vw, 36px)', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <Suspense fallback={<div style={{ ...litCard({ radius: 20 }) }}><div style={{ ...litCardInner({ radius: 19, pad: 32 }), color: INK_MUTE }}>Loading the form…</div></div>}>
            <ContactForm />
          </Suspense>

          <div style={{ display: 'grid', gap: 14 }}>
            <div style={litCard({ radius: 20 })}>
              <div style={litCardInner({ radius: 19, pad: 24 })}>
                <div style={{ ...kicker, marginBottom: 14 }}>Reach us direct</div>
                <DirectRow icon="mail" label="Email" value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
                <DirectRow icon="phone" label="Call or text" value={CONTACT.phoneDisplay} href={`tel:${CONTACT.phone}`} />
                <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 14, paddingTop: 14, color: INK_MUTE, fontSize: 13, lineHeight: 1.55 }}>
                  {CONTACT.city}{' '}&middot; The Loop runs Friday and Saturday nights, 7:30 PM to about 1:30 AM. Strictly 21+.
                </div>
              </div>
            </div>

            <div style={litCard({ radius: 20 })}>
              <div style={litCardInner({ radius: 19, pad: 24 })}>
                <div style={{ ...kicker, marginBottom: 12 }}>Follow the Loop</div>
                <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.6, margin: '0 0 14px' }}>
                  Route changes, weekend lineups, and last-minute seats go out here first.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer" style={socialPill}>Instagram</a>
                  <a href={SOCIALS.facebook} target="_blank" rel="noopener noreferrer" style={socialPill}>Facebook</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Band>

      {/* Answer-it-yourself band */}
      <Band tone="void" light="bottom" strength={0.14} rule>
        <Head kicker="Faster than waiting on us" title="Most questions have a button." />
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 36 }}>
          {QUICK.map(q => (
            <Link key={q.href} href={q.href} style={{ ...litCard({ radius: 18 }), textDecoration: 'none', display: 'block' }}>
              <div style={litCardInner({ radius: 17, pad: 24 })}>
                <div style={{ color: INK, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{q.q}</div>
                <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.6, margin: '9px 0 16px' }}>{q.a}</p>
                <span style={{ color: GOLD_HI, fontSize: 14, fontWeight: 700 }}>{q.cta} &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </Band>
    </main>
  )
}

function DirectRow({ icon, label, value, href }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none', padding: '12px 0' }}>
      <span aria-hidden style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 11, background: 'rgba(212,163,51,0.12)', border: '1px solid rgba(212,163,51,0.3)', display: 'grid', placeItems: 'center' }}>
        {icon === 'mail' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD_HI} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD_HI} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
          </svg>
        )}
      </span>
      <span>
        <span style={{ display: 'block', color: INK_MUTE, fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span style={{ display: 'block', color: INK, fontSize: 15.5, fontWeight: 700 }}>{value}</span>
      </span>
    </a>
  )
}

const kicker = {
  color: '#d4a333', fontSize: 11, letterSpacing: '0.2em',
  textTransform: 'uppercase', fontWeight: 700,
}

const socialPill = {
  display: 'inline-flex', alignItems: 'center', padding: '12px 16px', borderRadius: 999,
  border: `1px solid ${LINE}`, color: INK_DIM, fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
}
