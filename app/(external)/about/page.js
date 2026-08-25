import Link from 'next/link'
import { PUBLIC_PARTNER_BARS, PARTNER_BAR_COUNT, PARTNER_BAR_COUNT_WORD } from '@/lib/bars'
import { STEPS, FAQ } from '@/lib/riderInfo'
import { CONTACT } from '../_components/site/nav'
import { PageHero, Band, Head, Closer, h2, kickerStyle } from '../_components/marketing/PageShell'
import BarTiles from '../_components/marketing/BarTiles'
import Faq from '../_components/marketing/Faq'
import {
  GOLD, GOLD_HI, GOLD_INK, INK_DIM,
  ON_PAPER, ON_PAPER_DIM, ON_PAPER_MUTE,
  primaryCtaLg, ghostCta,
} from '@/lib/marketingTheme'
import { litCard, litCardInner } from '@/lib/atmosphere'
import { OG_IMAGES } from '@/lib/socialMeta'

// The full "how it works" reference. The landing page pitches and shows the top
// questions; this page is where a rider who wants the whole picture lands. Both
// read from lib/riderInfo.js so the two can't tell different stories, and both
// use the same hero/band/tile/FAQ shapes so they can't LOOK like two sites.
//
// ACCURACY: the Loop returns riders to their ORIGINAL PICKUP. Never "ride home."

export const metadata = {
  title: 'How It Works',
  description:
    'How a night on the Jville Brew Loop actually runs: book a seat, get to your first bar, then hop the shuttle between Jacksonville’s best spots all night without anyone driving.',
  alternates: { canonical: '/about' },
  openGraph: {
    images: OG_IMAGES,
    title: 'How the Jville Brew Loop works',
    description: 'Book a seat, get to your first bar, hop the shuttle all night. Nobody drives between stops.',
    url: '/about',
  },
  twitter: {
    images: OG_IMAGES,
    title: 'How the Jville Brew Loop works',
    description: 'Book a seat, get to your first bar, hop the shuttle all night. Nobody drives between stops.',
  },
}

const FACTS = [
  { k: '$20', v: 'Flat, per seat, all night' },
  { k: String(PARTNER_BAR_COUNT), v: 'Partner bars on a rotating route' },
  { k: '~1h15', v: 'At each stop' },
  { k: '21+', v: 'Every rider, no exceptions' },
]

export default function AboutPage() {
  return (
    <main className="site-main">
      <PageHero
        image="/brand/photos/about-hero.jpg"
        position="center 42%"
        kicker="How it works"
        title={<>A whole night out,<br /><span style={{ color: GOLD_HI }}>nobody behind the wheel.</span></>}
        sub="The Brew Loop is a flat-rate shuttle running a scheduled route between Jacksonville’s best bars every Friday and Saturday night. Book one seat, ride it as many times as you want, and never touch your keys between stops."
        actions={
          <>
            <Link href="/events" style={{ ...primaryCtaLg, padding: '17px 32px', fontSize: 17 }}>Book a seat &middot; $20</Link>
            <Link href="/track" style={{ ...ghostCta, padding: '16px 24px', fontSize: 15 }}>Find my bus</Link>
          </>
        }
      />

      {/* Facts — a thin strip, not four boxes */}
      <Band tone="raised" tight>
        <div style={{ display: 'grid', gap: 'clamp(18px, 3vw, 40px)', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {FACTS.map(f => (
            <div key={f.k}>
              <div style={{ color: GOLD_HI, fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{f.k}</div>
              <div style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.45, marginTop: 9 }}>{f.v}</div>
            </div>
          ))}
        </div>
      </Band>

      {/* The three steps — same timeline the landing page uses, plus the detail
          paragraph that only lives here. */}
      {/* ON PAPER, matching the same three steps on the landing page. This is
          pure type with no artwork that needs a dark field, and it is what
          keeps /about from running hero-to-closer as one long dark wall.
          Every colour below is an ON_PAPER token — see the note on Band. */}
      <Band tone="paper" light="top-right" strength={0.22} grain rule>
        <Head
          kicker="How a night runs"
          title="Three steps, then the night is handled."
          sub="It’s a tracked, scheduled route — not hop-on / hop-off — with your bar-hopping built into the timetable."
          tone="paper"
        />

        <ol style={{ listStyle: 'none', margin: '44px 0 0', padding: 0 }}>
          {STEPS.map((s, i) => {
            const last = i === STEPS.length - 1
            return (
              <li key={s.n} style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                  <span style={timelineNum}>{s.n}</span>
                  {!last && <span aria-hidden style={{ width: 2, flex: 1, minHeight: 30, background: `linear-gradient(180deg, ${GOLD}, rgba(212,163,51,0.22))` }} />}
                </div>
                <div style={{ paddingBottom: last ? 0 : 38, display: 'grid', gap: 'clamp(6px, 3vw, 40px)', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'start', flex: 1 }}>
                  <div>
                    <h3 style={{ color: ON_PAPER, fontSize: 'clamp(19px, 2.4vw, 23px)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{s.title}</h3>
                    <p style={{ color: ON_PAPER_DIM, fontSize: 15.5, lineHeight: 1.6, margin: '9px 0 0', maxWidth: 460 }}>{s.sub}</p>
                  </div>
                  <p style={{ color: ON_PAPER_MUTE, fontSize: 14.5, lineHeight: 1.7, margin: 0, paddingTop: 3, maxWidth: 480 }}>{s.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </Band>

      {/* Why — prose against a lit card, so it reads as a note rather than a box */}
      <Band tone="void" light="left" strength={0.12} rule>
        <div className="ab-why">
          <div>
            <div style={kickerStyle}>Why we built it</div>
            <h2 style={h2}>Jacksonville deserved a better night out.</h2>
          </div>
          <div style={litCard({ radius: 20 })}>
            <div style={litCardInner({ radius: 19, pad: 'clamp(24px, 4vw, 34px)' })}>
              <p style={prose}>
                Bar-hopping here used to come with a tax. Either somebody drew the short straw and sat the night out
                sober, or everybody piled into rideshares that surged, canceled, and split the group across three bars.
                Or &mdash; the one nobody says out loud &mdash; someone decided they were fine to drive.
              </p>
              <p style={{ ...prose, marginTop: 18 }}>
                So we built the thing we wanted: a shuttle on a real schedule, looping the bars people actually go to,
                for one flat price. Book once, ride all night, and the decision about who drives never has to get made.
              </p>
            </div>
          </div>
        </div>
        <style>{`
          .ab-why { display: grid; gap: 32px; }
          @media (min-width: 940px) {
            .ab-why { grid-template-columns: 0.85fr 1.15fr; gap: 56px; align-items: center; }
          }
        `}</style>
      </Band>

      {/* Where it goes — the same tiles the homepage uses */}
      <Band tone="base" light="top-left" strength={0.1} rule>
        <Head
          kicker="Where it goes"
          title={`${cap(PARTNER_BAR_COUNT_WORD)} partner bars, one rotating route.`}
          sub="The lineup rotates weekend to weekend, and Friday can differ from Saturday. The night you book always lists its exact stops."
          aside={<Link href="/bars" style={{ ...ghostCta, padding: '13px 22px' }}>All {PARTNER_BAR_COUNT} bars</Link>}
        />
        <BarTiles bars={PUBLIC_PARTNER_BARS} min={200} />
      </Band>

      {/* The canonical FAQ — the landing page shows the top few and links here */}
      <Band tone="paper" light="right" strength={0.2} grain rule id="faq">
        <Head kicker="FAQ" title="Questions riders ask." tone="paper" />
        <Faq items={FAQ} tone="paper" />
        <p style={{ color: ON_PAPER_MUTE, fontSize: 14.5, lineHeight: 1.6, margin: '26px 0 0' }}>
          Still stuck?{' '}
          <Link href="/contact" style={{ color: GOLD_INK, fontWeight: 700, textDecoration: 'none' }}>Send us a message</Link>
          {' '}or call <a href={`tel:${CONTACT.phone}`} style={{ color: GOLD_INK, fontWeight: 700, textDecoration: 'none' }}>{CONTACT.phoneDisplay}</a>.
        </p>
      </Band>

      <Closer
        title={<>Grab a seat for<br /><span style={{ color: GOLD_HI }}>this weekend.</span></>}
        sub="$20, the whole night, and nobody in your group has to be the one who drives."
        secondary={<Link href="/bars" style={{ ...ghostCta, padding: '17px 26px', fontSize: 15 }}>See the bars</Link>}
      />
    </main>
  )
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

const prose = { color: INK_DIM, fontSize: 'clamp(15px, 2vw, 16.5px)', lineHeight: 1.7, margin: 0 }

// The step marker sits on a paper band. Brand gold is only ~2.3:1 on cream so
// the numeral is GOLD_INK; the gold stays as the ring and the wash, where it's
// decoration and contrast doesn't apply.
const timelineNum = {
  flex: '0 0 auto', width: 44, height: 44, borderRadius: 13,
  border: '1px solid rgba(212,163,51,0.7)',
  background: 'linear-gradient(160deg, rgba(212,163,51,0.28), rgba(212,163,51,0.10))',
  color: GOLD_INK, fontSize: 15, fontWeight: 800,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
