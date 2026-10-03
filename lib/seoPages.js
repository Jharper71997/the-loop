// Search-landing pages for the Brew Loop website, as DATA.
//
// Each record below targets one keyword cluster from the Oct 2026 keyword map
// (C:\Users\jacob\drive-cache\vid\brewloop-keyword-map.md). The route
// /jacksonville-nc/[slug] renders every record through ONE template
// (app/(external)/_components/marketing/LandingTemplate.jsx), the sitemap and
// the /jacksonville-nc hub list them, and each page emits WebPage +
// BreadcrumbList + FAQPage JSON-LD built from these same fields. Add a cluster
// here and nothing else needs touching except middleware (already covered by
// the '/jacksonville-nc' prefix).
//
// Fields:
//   slug, linkLabel, linkBlurb    URL + how other pages link to it
//   shortLabel                    footer link text
//   keywords.primary / secondary  the searches this page is written for (docs
//                                 only; never rendered as a meta keywords tag)
//   meta.title / meta.description <title> and description, written to the
//                                 search, under ~60 / ~160 chars
//   hero, intro, points, faq,     the page sections, in order
//   featured, closer, related
//
// RULES FOR EVERY WORD IN HERE (same as the rest of the site):
//   - No alcohol marketing. The Loop is a shuttle. Copy is about the night
//     out, the bars as places, and getting around safely. Never drinks, never
//     specials. (memory: feedback_brewloop_no_alcohol_marketing)
//   - No discounts. $20 a seat is the offer.
//   - Never invent a fact. Every claim traces to lib/riderInfo.js (times,
//     price, 21+, stop length, pickup), lib/bars.js (what each bar is), or
//     the Loop Pass ($25/month). Bar names come from lib/bars.js at render.
//   - Never "ride home": the Loop returns riders to their ORIGINAL PICKUP.
//   - Never call the shuttle "private"; say "friends", not "crew".
//   - No unverified bar claims (Jacob, 2026-10-02): no karaoke or live-music
//     nights/schedules and no "veteran-owned", even though lib/bars.js has
//     them; those descriptions were never checked with the bars. That is why
//     there are no karaoke or live-music pages. Archies Pub is a FRIDAY-ONLY
//     stop (it gave its Saturday slot to Brassa, 2026-08-29): say so wherever
//     copy covers the route or whether a bar is on the Loop (ROUTE_NOTES).
//   - Never "party bus": nothing may imply a private bus.
//   - No private-charter pitch. Jacob, 2026-08-27: private parties are sold by
//     hidden link only. The group page sells PUBLIC nights to groups.

import { PUBLIC_PARTNER_BARS, PARTNER_BAR_COUNT, PARTNER_BAR_COUNT_WORD, getBar } from './bars'

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
const N = PARTNER_BAR_COUNT
const NW = PARTNER_BAR_COUNT_WORD
// Per-bar route caveats, keyed by lib/bars.js slug. Applied wherever copy lists
// the route or answers "is X on the Brew Loop".
export const ROUTE_NOTES = {
  archies: 'Fridays only',
}
const barList = PUBLIC_PARTNER_BARS.map(b => (ROUTE_NOTES[b.slug] ? `${b.name} (${ROUTE_NOTES[b.slug]})` : b.name)).join(', ')

// The facts strip under each hero.
const CORE_FACTS = ['$20 a seat', 'Friday + Saturday', `${N} partner bars`, 'Strictly 21+']

// Questions every page can carry, worded once. All from lib/riderInfo FAQ.
const Q = {
  price: { q: 'How much is the Brew Loop?', a: '$20 per seat. One ticket covers your whole night on the shuttle. If you ride often, the Loop Pass is $25 a month.' },
  times: { q: 'What nights and times does it run?', a: 'Friday and Saturday nights. First pickup is around 7:30 PM and the night wraps around 1:30 AM.' },
  age: { q: 'Do I have to be 21?', a: 'Yes. The Brew Loop is strictly 21+. Bring a valid photo ID; we or the bars may ask to see it.' },
  getThere: { q: 'How do I get to the shuttle and back?', a: 'Leave your car at home. Take an Uber or one of our partnered taxis to your pickup bar. The Loop runs between the bars all night and brings you back to that same pickup at the end, and you grab a ride home from there.' },
  stops: { q: 'Which bars are on the route?', a: `${cap(NW)} partner bars around Jacksonville, NC rotate weekend to weekend, and Friday’s route can differ from Saturday’s. The night you book lists its exact stops.` },
  stopLength: { q: 'How long is each stop?', a: 'About an hour and 15 minutes per bar, with a text roughly 10 minutes before the shuttle rolls. It is a tracked, scheduled route you can follow live.' },
  missed: { q: 'What if I miss the shuttle?', a: 'Stay put and catch it on the next pass. It loops the same route all night, and the live tracker shows where it is and which stop is next.' },
  group: { q: 'We have a group of 5 or more. Can you pick us up somewhere else?', a: 'Often, yes, depending on the night. Send us the date, party size, and where you’d be starting and we’ll tell you straight away whether we can line it up.' },
}

export const LANDING_PAGES = [
  // ---------------------------------------------------------------------------
  {
    slug: 'bar-hopping',
    shortLabel: 'Bar hopping',
    linkLabel: 'Bar hopping in Jacksonville, NC',
    linkBlurb: 'A bar crawl on a schedule, with a shuttle between every stop',
    keywords: {
      primary: 'bar hopping jacksonville nc',
      secondary: ['bar crawl jacksonville nc', 'bar hop shuttle jacksonville nc', 'pub crawl jacksonville nc', 'bar shuttle jacksonville nc', 'best bars in jacksonville nc'],
    },
    meta: {
      title: 'Bar Hopping & Bar Crawl Shuttle in Jacksonville, NC',
      description: `Bar hop Jacksonville, NC without driving. The Brew Loop shuttle runs a scheduled bar crawl between ${N} partner bars every Friday and Saturday night. $20 a seat.`,
    },
    hero: {
      image: '/brand/photos/bars-hero.jpg',
      position: 'center 38%',
      kicker: 'Bar crawl, Jacksonville NC',
      title: 'Bar hopping in Jacksonville,',
      highlight: 'with a shuttle between every stop.',
      sub: `The Brew Loop is a bar hop shuttle that runs a scheduled loop between ${N} partner bars every Friday and Saturday night. One $20 seat, the whole night, and nobody in your group has to drive.`,
    },
    facts: CORE_FACTS,
    intro: {
      kicker: 'The short version',
      title: 'A bar crawl that plans itself.',
      body: [
        'A bar crawl in Jacksonville, NC usually falls apart on the driving. Somebody sits the night out as the designated driver, or the group splits across rideshares and ends up at three different bars. The Brew Loop fixes the part in between: a shuttle on a real schedule, looping the partner bars all night.',
        `You book one seat, get to your pickup bar, and ride bar to bar with your friends. The shuttle spends about an hour and 15 minutes at each stop, texts you roughly 10 minutes before it rolls, and at the end of the night it brings you back to your original pickup.`,
        `The route pulls from ${NW} partner bars: ${barList}. It rotates weekend to weekend, so the night you book always lists its exact stops.`,
      ],
    },
    points: {
      kicker: 'How the crawl works',
      title: 'Three things that make it work.',
      items: [
        { t: 'One seat, all night', d: '$20 covers every leg of the loop. No per-ride fares, no surge pricing, no splitting a fare five ways at 1 AM.' },
        { t: 'A real schedule', d: 'About an hour and 15 minutes per bar, a text before the shuttle leaves, and a live tracker so you always know where the bus is.' },
        { t: 'Back where you started', d: 'The Loop returns you to your original pickup at the end of the route. Uber or a partnered taxi gets you there and home from there.' },
      ],
    },
    showBars: true,
    barsTitle: 'The bars on the crawl.',
    faq: [Q.price, Q.stops, Q.stopLength, Q.getThere, Q.missed, Q.age],
    closer: { title: 'Plan the crawl', highlight: 'in about a minute.', sub: 'Pick a Friday or Saturday, pick your pickup bar, and the route is handled.' },
    related: ['things-to-do-at-night', 'getting-around-at-night', 'group-nights'],
  },

  // ---------------------------------------------------------------------------
  {
    slug: 'things-to-do-at-night',
    shortLabel: 'Things to do at night',
    linkLabel: 'Things to do in Jacksonville, NC at night',
    linkBlurb: 'Friday and Saturday night ideas for adults, 21+',
    keywords: {
      primary: 'things to do in jacksonville nc at night',
      secondary: ['things to do in jacksonville nc this weekend for adults', 'things to do in jacksonville nc tonight', 'nightlife jacksonville nc', 'date night jacksonville nc', 'fun things to do in jacksonville nc for adults', 'things to do in onslow county this weekend'],
    },
    meta: {
      title: 'Things to Do in Jacksonville, NC at Night (21+)',
      description: 'Looking for things to do in Jacksonville, NC this weekend? Ride the Brew Loop shuttle between partner bars on Friday and Saturday night, and nobody has to drive. $20 a seat, 21+.',
    },
    hero: {
      image: '/brand/photos/hero-poster.jpg',
      position: 'center 40%',
      kicker: 'Jacksonville nightlife',
      title: 'Things to do in Jacksonville',
      highlight: 'on a Friday or Saturday night.',
      sub: 'If you are 21+ and looking for something to do in Jacksonville, NC tonight or this weekend, the Brew Loop strings the night together for you: one shuttle, a loop of partner bars, and nobody stuck driving.',
    },
    facts: CORE_FACTS,
    intro: {
      kicker: 'Jacksonville after dark',
      title: 'A night out that doesn’t need a plan.',
      body: [
        'Most nights out in Jacksonville, NC start with the same questions. Where are we going, who is driving, and how do we all end up at the same place. The Brew Loop answers all three: a scheduled shuttle loops the partner bars every Friday and Saturday night, and you ride it for one flat $20 seat.',
        'The bars are the night: pool and darts at most stops, the oldest bar in Jacksonville at Shirley V’s, and a real kitchen at Unhinged and Brassa. Which of them run on a given night depends on the weekend’s route, and the night you book lists its exact stops.',
        'It works as a date night, a night out with friends, or a reason to finally see the bars across Onslow County you keep driving past.',
      ],
    },
    points: {
      kicker: 'Pick your kind of night',
      title: 'Ways to spend it.',
      items: [
        { t: 'Games and a good room', d: 'Pool, darts, cornhole and foosball across the partner bars, plus the oldest bar in Jacksonville at Shirley V’s, open since 1952.' },
        { t: 'Date night', d: 'Two seats, a few bars, and neither of you has to be the one who drives. Dinner at Brassa or Unhinged works as a first stop when they’re on the route.' },
      ],
    },
    showBars: true,
    barsTitle: 'Where the night goes.',
    faq: [Q.times, Q.price, Q.age, Q.stops, Q.getThere, Q.stopLength],
    closer: { title: 'Something to do', highlight: 'this weekend.', sub: '$20 a seat, Friday and Saturday nights, back to your pickup at the end.' },
    related: ['bar-hopping', 'getting-around-at-night', 'group-nights'],
  },

  // ---------------------------------------------------------------------------
  {
    slug: 'getting-around-at-night',
    shortLabel: 'Getting around safely',
    linkLabel: 'Getting around Jacksonville, NC at night',
    linkBlurb: 'Uber, taxis and the bar shuttle, without anyone driving',
    keywords: {
      primary: 'transportation jacksonville nc',
      secondary: ['does jacksonville nc have uber', 'taxi jacksonville nc', 'taxi service jacksonville nc', 'bar shuttle jacksonville nc', 'designated driver jacksonville nc', 'safe ride jacksonville nc'],
    },
    meta: {
      title: 'Getting Around Jacksonville, NC at Night Without Driving',
      description: 'How to get around Jacksonville, NC on a night out without driving: Uber or a taxi to your pickup, then the Brew Loop bar shuttle between bars all night for $20.',
    },
    hero: {
      image: '/brand/photos/shuttle.jpg',
      position: 'center 55%',
      kicker: 'Safe ride, Jacksonville NC',
      title: 'A night out in Jacksonville',
      highlight: 'where nobody has to drive.',
      sub: 'Uber and taxis get you to the first bar. The Brew Loop shuttle handles everything after that: a scheduled loop between partner bars on Friday and Saturday nights, back to your pickup at the end.',
    },
    facts: CORE_FACTS,
    intro: {
      kicker: 'The getting-around problem',
      title: 'Nobody has to be the designated driver.',
      body: [
        'Getting around Jacksonville, NC at night usually means one of three things. Somebody stays sober as the designated driver, everybody piles into rideshares and hopes the group lands at the same bar, or someone decides they’re fine to drive. The Brew Loop exists so the third one never comes up.',
        'Here is how a safe night out works with the Loop. Take an Uber or one of our partnered taxis to your pickup bar. From there, the shuttle runs a scheduled route between the partner bars all night, about an hour and 15 minutes at each stop. At the end of the route it brings you back to your original pickup, and you grab a ride home from there.',
        'The Loop is not a ride home and not a taxi. It is the part in between: every leg from bar to bar, for one $20 seat.',
      ],
    },
    points: {
      kicker: 'The whole night, leg by leg',
      title: 'How you get from start to finish.',
      items: [
        { t: 'To the first bar', d: 'Leave the car at home. An Uber or one of our partnered taxis gets you to your pickup bar. We text you the exact time and place.' },
        { t: 'Bar to bar', d: 'The Brew Loop shuttle, on a schedule you can track live. One seat covers every leg, no per-ride fares and no surge.' },
        { t: 'Home', d: 'The Loop returns you to your original pickup at the end of the route. Grab an Uber or a taxi home from there.' },
      ],
    },
    showBars: false,
    faq: [
      { q: 'Does the Brew Loop take me home?', a: 'No. The Loop runs between the partner bars and returns you to your original pickup at the end of the night. Take an Uber or one of our partnered taxis home from there.' },
      Q.getThere, Q.missed, Q.price, Q.times, Q.age,
    ],
    closer: { title: 'Leave the keys', highlight: 'at home.', sub: 'One $20 seat covers every ride between bars, Friday and Saturday night.' },
    related: ['bar-hopping', 'things-to-do-at-night', 'camp-lejeune'],
  },

  // ---------------------------------------------------------------------------
  {
    slug: 'camp-lejeune',
    shortLabel: 'Near Camp Lejeune',
    linkLabel: 'Things to do near Camp Lejeune at night',
    linkBlurb: 'A Jacksonville night out for 21+ Marines, sailors and families',
    keywords: {
      primary: 'things to do near camp lejeune',
      secondary: ['camp lejeune bars', 'fun things to do near camp lejeune', 'things to do near camp lejeune nc', 'marine bar in jacksonville nc', 'things to do around camp lejeune'],
    },
    meta: {
      title: 'Things to Do Near Camp Lejeune at Night | Jacksonville Bars',
      description: 'Bars and nightlife near Camp Lejeune in Jacksonville, NC. Ride the Brew Loop shuttle between partner bars Friday and Saturday night, nobody driving. $20, 21+.',
    },
    hero: {
      image: '/brand/photos/about-hero.jpg',
      position: 'center 42%',
      kicker: 'Near Camp Lejeune',
      title: 'A night out near Camp Lejeune,',
      highlight: 'nobody behind the wheel.',
      sub: 'Jacksonville, NC sits right outside Camp Lejeune. On Friday and Saturday nights the Brew Loop shuttle loops partner bars around town for one $20 seat, 21+ with ID.',
    },
    facts: CORE_FACTS,
    intro: {
      kicker: 'Off base, in town',
      title: 'Jacksonville’s bars, without the car.',
      body: [
        'If you are stationed at Camp Lejeune or New River and looking for something to do at night, most of Jacksonville’s nightlife is a short ride off base. The problem is getting between bars once you are out.',
        'The Brew Loop is a scheduled shuttle that loops partner bars across Jacksonville every Friday and Saturday night. Get to your pickup bar by Uber or a partnered taxi, ride bar to bar all night, and the Loop returns you to that same pickup at the end.',
        'A separate shuttle built for Marines, the Marines Loop, is coming soon. It is its own service and is not part of the Brew Loop.',
      ],
    },
    points: {
      kicker: 'Before you go',
      title: 'What to know.',
      items: [
        { t: 'Strictly 21+', d: 'Every rider, no exceptions. Bring a valid photo ID; we or the bars may ask to see it.' },
        { t: 'Getting to the pickup', d: 'The Loop runs between the bars and does not come on base. An Uber or one of our partnered taxis gets you to your pickup bar.' },
        { t: 'One price', d: '$20 per seat covers the whole night. If you ride most weekends, the Loop Pass is $25 a month.' },
      ],
    },
    showBars: true,
    barsTitle: 'Bars on the route near base.',
    faq: [Q.age, Q.getThere, Q.price, Q.times, Q.stops, Q.missed],
    closer: { title: 'Get off base', highlight: 'and go do something.', sub: '$20 a seat, Friday and Saturday nights, 21+.' },
    related: ['getting-around-at-night', 'things-to-do-at-night', 'bar-hopping'],
  },

  // ---------------------------------------------------------------------------
  {
    slug: 'group-nights',
    shortLabel: 'Birthdays and groups',
    linkLabel: 'Birthdays and group nights out',
    linkBlurb: 'Bring your friends on the Loop for a birthday or a big night',
    keywords: {
      primary: 'birthday ideas for adults jacksonville nc',
      secondary: ['birthday party places jacksonville nc', 'jacksonville birthday ideas for adults', 'bachelorette party jacksonville nc', 'group transportation jacksonville nc'],
    },
    meta: {
      title: 'Birthday and Group Nights Out in Jacksonville, NC',
      description: 'Planning a birthday or a group night out in Jacksonville, NC? Everyone books a $20 seat on the Brew Loop bar shuttle, Friday and Saturday night, and nobody drives. 21+.',
    },
    cta: { href: '/events', label: 'Book seats · $20 each' },
    hero: {
      image: '/brand/photos/contact-hero.jpg',
      position: 'center 40%',
      kicker: 'Groups, Jacksonville NC',
      title: 'Birthdays and big nights out,',
      highlight: 'with everyone on one shuttle.',
      sub: 'Bring your friends on the Brew Loop for a birthday, a bachelorette, or just a big Saturday. Everyone books a $20 seat, the shuttle handles every ride between bars, and nobody has to drive.',
    },
    facts: CORE_FACTS,
    intro: {
      kicker: 'For groups',
      title: 'The group plan that keeps everyone together.',
      body: [
        'Group nights out in Jacksonville, NC tend to come apart in the parking lot. Five cars, three rideshares, and half the group at the wrong bar. On the Brew Loop the whole group rides the same shuttle, to the same bars, on the same schedule.',
        'Everyone books their own $20 seat for the same night and pickup bar. The shuttle spends about an hour and 15 minutes at each partner bar and brings everyone back to the original pickup at the end of the night.',
        'The Loop is one shuttle running a public route, and other riders come along too, which is a big part of the fun.',
      ],
    },
    points: {
      kicker: 'Planning it',
      title: 'How to bring a group.',
      items: [
        { t: 'Pick the night together', d: 'Choose a Friday or Saturday and the same pickup bar, and have everyone book a seat. Booking ahead is the only way to be sure of a spot.' },
        { t: '5 or more? Ask us', d: 'For groups of five or more we can often pick you up somewhere other than a partner bar, depending on the night. Send us the date, party size and starting point.' },
        { t: 'Everyone 21+', d: 'Every rider needs to be 21 or older with a valid photo ID, including the guest of honor.' },
      ],
    },
    showBars: true,
    barsTitle: 'Where the group goes.',
    faq: [Q.group, Q.price, Q.age, Q.times, Q.getThere, Q.stops],
    closer: { title: 'Get the whole group', highlight: 'on one shuttle.', sub: 'Everyone books a $20 seat. Groups of five or more, message us about pickup.' },
    related: ['bar-hopping', 'things-to-do-at-night', 'getting-around-at-night'],
  },
]

export function getLandingPage(slug) {
  return LANDING_PAGES.find(p => p.slug === slug) || null
}

// Resolve a featured block's slugs to real partner bars. A slug that is not a
// current public partner is dropped, so a bar leaving lib/bars.js can never
// leave a dangling claim on a landing page.
export function featuredBars(featured) {
  if (!featured) return []
  return featured.items
    .map(it => ({ bar: getBar(it.slug), note: it.note }))
    .filter(x => x.bar && PUBLIC_PARTNER_BARS.some(b => b.slug === x.bar.slug))
}

// ------------------------------------------------------------- Bar pages ----
// Templated copy for /bars/[slug]. Every field is lib/bars.js data or a
// lib/riderInfo fact, so it is true for every bar without per-bar writing.

export function barGettingThere(bar) {
  return {
    kicker: 'Getting there',
    title: `Getting to ${bar.name} without driving.`,
    body: [
      `${bar.name} is at ${bar.address}. It is one of the ${NW} partner bars on the Jville Brew Loop, the Friday and Saturday night bar-hop shuttle in Jacksonville, NC.`,
      `${ROUTE_NOTES[bar.slug] === 'Fridays only' ? `${bar.name} is a Friday-only stop. ` : ''}On nights when ${bar.name} is on the route, the shuttle stops here for about an hour and 15 minutes, then moves on to the next partner bar. Book a $20 seat, take an Uber or one of our partnered taxis to your pickup bar, and the Loop returns you to that pickup at the end of the night.`,
    ],
  }
}

export function barFaq(bar) {
  return [
    { q: `Where is ${bar.name}?`, a: `${bar.name} is at ${bar.address}.` },
    { q: `Is ${bar.name} on the Brew Loop?`, a: ROUTE_NOTES[bar.slug] === 'Fridays only'
      ? `Yes, on Friday nights. ${bar.name} is one of the ${NW} partner bars on the Jville Brew Loop and is a Friday-only stop. Check the Friday you’re booking for its exact stops.`
      : `Yes. ${bar.name} is one of the ${NW} partner bars on the Jville Brew Loop. The route rotates weekend to weekend and Friday can differ from Saturday, so check the night you’re booking for its exact stops.` },
    { q: `How do I get to ${bar.name} without driving?`, a: `Book a $20 seat on the Brew Loop. Get to your pickup bar by Uber or one of our partnered taxis, and the shuttle runs between the partner bars all night, then brings you back to your original pickup.` },
    { q: `How long does the shuttle stay at ${bar.name}?`, a: 'About an hour and 15 minutes per stop. You get a text roughly 10 minutes before the shuttle rolls.' },
  ]
}
