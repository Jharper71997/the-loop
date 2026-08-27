import Link from 'next/link'
import { PageHero, Band, Head } from '../_components/marketing/PageShell'
import { OG_IMAGES } from '@/lib/socialMeta'
import { GOLD, INK, INK_DIM, INK_MUTE, LINE, SURFACE, ON_PAPER, ON_PAPER_DIM } from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'
import { CONTACT } from '../_components/site/nav'
import PartyRequestForm from './PartyRequestForm'

export const metadata = {
  title: 'Private Parties',
  description:
    'Book the whole Jville Brew Loop shuttle for your own night. Your group, your bars, your route. Bachelorettes, birthdays, work nights and reunions.',
  alternates: { canonical: '/parties' },
  openGraph: {
    images: OG_IMAGES,
    title: 'Book the whole shuttle',
    description: 'Your group. Your bars. Your route. Private outings on the Jville Brew Loop.',
    url: '/parties',
  },
  twitter: {
    images: OG_IMAGES,
    title: 'Book the whole shuttle',
    description: 'Your group. Your bars. Your route. Private outings on the Jville Brew Loop.',
  },
}

// This page is the ONLY public surface for private parties. It sells the idea
// and takes a request — it never exposes a bookable party. Actual parties live
// at /party/<token>, which is unlisted, noindexed and handed out by us.
//
// Why a request form and not a buy button: every party is priced on its own
// (whole shuttle, one flat number) because a Tuesday in February and a Saturday
// in October are not the same night to give away. We quote, then we send a link.

const OCCASIONS = [
  { title: 'Bachelor & bachelorette', body: 'The whole party on one bus, nobody driving, nobody peeling off to find parking.' },
  { title: 'Birthdays', body: 'Pick the bars that actually mean something to them instead of whichever one has a table.' },
  { title: 'Work nights & team socials', body: 'Everybody arrives together, everybody leaves together, and nobody drives home.' },
  { title: 'Reunions & family weekends', body: 'People in from out of town see the whole city in one night without a rental car.' },
]

const STEPS = [
  { n: '01', title: 'Tell us the night', body: 'Your date, how many people, and any bars you already know you want.' },
  { n: '02', title: 'We quote the shuttle', body: 'One flat number for the whole bus, not a price per head. We text it to you.' },
  { n: '03', title: 'You lock it in', body: 'We send a private link. One person pays, everyone else gets a link to sign their own waiver.' },
  { n: '04', title: 'We build your route', body: 'We plan the stops and times around your group, and the finished itinerary shows up on your page.' },
]

export default function PartiesPage() {
  return (
    <main className="site-main">
      <PageHero
        kicker="Private outings"
        title="Book the whole shuttle."
        sub="Your group, your bars, your route, and nobody else on the bus. We build the night around you and drive it."
        image="/brand/photos/shuttle.jpg"
        actions={
          <>
            <Link href="#request" style={heroCta}>Request your night</Link>
            <a href={`tel:${CONTACT.phone}`} style={heroGhost}>Call {CONTACT.phoneDisplay}</a>
          </>
        }
        facts={['Up to 14 riders', 'One flat price', 'Fri, Sat or a weeknight']}
      />

      {/* What it is. The single most common misread of the Loop is that a
          private party is "buying 14 seats on the Friday loop" — it is not.
          This band exists to kill that before anything else. */}
      <Band tone="base" light="top-left" strength={0.14} grain>
        <Head
          kicker="What you are actually booking"
          title="Not seats on our loop. The bus."
          sub="The public Loop runs a fixed route on Friday and Saturday and picks up whoever bought a ticket. A private outing is the opposite: the shuttle leaves our schedule, runs yours, and carries nobody but your group."
        />
        <div style={grid3}>
          {[
            { k: 'Your route', v: 'Name the bars. We sequence them, time them, and drive it.' },
            { k: 'Your night', v: 'Friday, Saturday, or a weeknight the public loop does not run.' },
            { k: 'Your group only', v: 'No strangers boarding at the next stop. The bus is yours until you are done.' },
          ].map(c => (
            <div key={c.k} style={litCard({ radius: 16 })}>
              <div style={litCardInner({ radius: 15, pad: 20 })}>
                <div style={{ color: GOLD, fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.k}</div>
                <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.55, margin: '10px 0 0' }}>{c.v}</p>
              </div>
            </div>
          ))}
        </div>
      </Band>

      {/* Occasions, on paper. The dark bands carry the product; this one is
          the reader recognising themselves in it, so it gets the light end of
          the rhythm — and therefore the ON_PAPER tokens (a Band cannot
          recolour its children, see PageShell). */}
      <Band tone="paper" light="top-right" strength={0.16} rule>
        <Head
          tone="paper"
          kicker="Who books these"
          title="The nights people do not want to organize twice."
          sub="If getting everyone to the same bar is already the hardest part of the plan, this is the fix."
        />
        <div style={grid2}>
          {OCCASIONS.map(o => (
            <div key={o.title} style={paperCardStyle}>
              <div style={{ color: ON_PAPER, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{o.title}</div>
              <p style={{ color: ON_PAPER_DIM, fontSize: 14.5, lineHeight: 1.6, margin: '8px 0 0' }}>{o.body}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* How it works — the four steps, in the order they actually happen. */}
      <Band tone="base" light="bottom" strength={0.12} grain rule>
        <Head
          kicker="How it works"
          title="Four steps, and we do three of them."
        />
        <div style={grid4}>
          {STEPS.map(s => (
            <div key={s.n} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
              <div style={{ color: GOLD, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em' }}>{s.n}</div>
              <div style={{ color: INK, fontSize: 16, fontWeight: 800, margin: '10px 0 0', letterSpacing: '-0.01em' }}>{s.title}</div>
              <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, margin: '8px 0 0' }}>{s.body}</p>
            </div>
          ))}
        </div>

        {/* The one thing that costs us bookings if it is a surprise later:
            everybody riding has to sign, and the bus is 21+. Said here, once,
            before they have committed to anything. */}
        <div style={{
          marginTop: 34, padding: '18px 20px', borderRadius: 14,
          background: SURFACE, border: `1px solid ${LINE}`,
        }}>
          <div style={{ color: INK, fontSize: 14.5, fontWeight: 700 }}>Before you ask us the two questions everyone asks</div>
          <p style={{ color: INK_MUTE, fontSize: 14, lineHeight: 1.6, margin: '8px 0 0' }}>
            Every rider signs a waiver — the person who pays gets a link to send to
            everyone else, so you are not chasing paperwork. And the shuttle is
            strictly 21+, no exceptions, including for private nights.
          </p>
        </div>
      </Band>

      {/* The ask. Everything above exists to get someone to this form. */}
      <Band id="request" tone="void" light="top" strength={0.2} grain rule>
        <Head
          kicker="Request your night"
          title="Tell us the date and we will price it."
          sub="This is not a booking and it does not charge you anything. Send it over and we come back with one flat number for the whole shuttle."
        />
        <div style={{ marginTop: 30 }}>
          <PartyRequestForm />
        </div>
      </Band>
    </main>
  )
}

/* --------------------------------- styles -------------------------------- */

const heroCta = {
  display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
  padding: '14px 22px', borderRadius: 999, background: GOLD, color: '#0a0a0b',
  fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
}

const heroGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
  padding: '13px 20px', borderRadius: 999,
  background: 'rgba(18,18,21,0.55)', border: '1px solid rgba(255,255,255,0.14)',
  color: INK, fontSize: 14.5, fontWeight: 700,
}

const grid2 = { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 30 }
const grid3 = { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginTop: 30 }
const grid4 = { display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginTop: 30 }

const paperCardStyle = {
  background: '#fffdf8',
  border: '1px solid rgba(23,19,15,0.10)',
  borderRadius: 16,
  padding: '20px 22px',
  boxShadow: '0 1px 2px rgba(23,19,15,0.04)',
}
