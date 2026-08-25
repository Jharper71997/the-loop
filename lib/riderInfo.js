// The rider-facing facts about a night on the Brew Loop, in ONE place.
//
// The landing page (/) pitches, /about is the full reference, and both used to
// carry their own hand-written copies — which had already drifted (three steps
// on the landing page, four on /about; two FAQ lists answering the same
// questions differently). A rider who read both got two stories. Now they read
// the same one, at different depths: the landing page shows LANDING_FAQ_COUNT
// questions and links to /about for the rest.
//
// ACCURACY, do not break: the Loop is a bar-hop shuttle that returns riders to
// their ORIGINAL PICKUP. It is NOT a ride home, and no copy here may imply it.
// You reach the Loop, and leave it, by Uber or a partnered taxi.

import { PARTNER_BAR_COUNT_WORD } from './bars'

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

// How a night runs. `detail` is the extra paragraph only /about renders.
export const STEPS = [
  {
    n: '01',
    title: 'Book your seat',
    sub: '$20 covers your whole night. Sign the waiver inline, pay, done — takes a minute.',
    detail: 'Every rider signs the waiver during checkout, so there is nothing to print or hand over at the door. You get a texted confirmation with your pickup time and a boarding pass you can pull up on your phone.',
  },
  {
    n: '02',
    title: 'Get to the first bar',
    sub: 'Leave the car at home. Grab an Uber or one of our partnered taxis to your pickup spot. We text you the exact time and place.',
    detail: 'This is the part people miss: the Loop runs between the bars, it does not come to your house. Get yourself to the pickup bar however you like — just not behind your own wheel, because your car would be stuck there all night anyway.',
  },
  {
    n: '03',
    title: 'Hop the Loop all night',
    sub: 'Ride bar to bar with your friends, track the shuttle live, and end the night right back where you started.',
    detail: 'About an hour and 15 minutes at each stop, with a text roughly 10 minutes before the shuttle rolls so you can close your tab. Track the bus live the whole time. At the end of the route it returns you to your original pickup, and you grab a ride home from there.',
  },
]

// Questions riders actually ask, most common first. The landing page shows the
// first LANDING_FAQ_COUNT; /about shows all of them.
export const FAQ = [
  { q: 'How much is a ticket?', a: '$20 per seat. One ticket covers your whole night on the Loop.' },
  { q: 'How long are we at each bar?', a: 'About an hour and 15 minutes per stop. It’s a tracked, scheduled route — not hop-on / hop-off.' },
  { q: 'How do I get to and from the Loop?', a: 'Leave your car at home. Take an Uber or one of our partnered taxi services to your pickup spot, ride the Loop all night, and it brings you back to that same spot at the end. Grab a ride home from there.' },
  { q: 'How will I know when the shuttle is leaving?', a: 'You’ll get a text about 10 minutes before we roll, so you can close your tab and finish your drink.' },
  { q: 'What time does it run?', a: 'First pickup is around 7:30 PM and we wrap up around 1:30 AM, Friday and Saturday nights.' },
  { q: 'Do I have to be 21?', a: 'Yes. The Loop is strictly 21+, and every rider is checked.' },
  { q: 'Which bars are on the route?', a: `${cap(PARTNER_BAR_COUNT_WORD)} partner bars around Jacksonville rotate weekend to weekend, and Friday’s route can differ from Saturday’s. Check the event you’re booking for that night’s exact stops.` },
  { q: 'We have a group of 5 or more — can you pick us up somewhere else?', a: 'Often, yes, depending on the night. Send us the date, party size, and where you’d be starting and we’ll tell you straight away whether we can line it up.' },
  { q: 'What if I miss the shuttle?', a: 'Stay put and catch it on the next pass — it loops the same route all night. The live tracker shows you exactly where it is and which stop it’s heading to next.' },
  { q: 'Can I buy a seat at the bar that night?', a: 'Sometimes. Walk-up seats depend on what’s left after booked riders, and a walk-up isn’t guaranteed a spot on the return pass. Booking ahead is the only way to be sure.' },
]

export const LANDING_FAQ_COUNT = 5
