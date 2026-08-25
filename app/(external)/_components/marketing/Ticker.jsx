import { GOLD, GOLD_HI, ON_GOLD } from '@/lib/marketingTheme'

// A slow marquee of the offer, in gold.
//
// Two jobs. First, it is the only motion on this site that ISN'T tied to scroll
// position — everything else moves only while you do, which means a page
// sitting still is completely dead, and the moment right after the hero pin
// releases is exactly where that shows. Second, it is a band of solid gold in
// the middle of a dark page: Jacob's "i dont want it all black" is answered as
// much by one saturated strip as by a lighter grey.
//
// The items are the offer stated as plainly as it can be stated. Nothing here
// is a claim that needs checking and nothing mentions drinks — see the Brew
// Loop rule about not marketing alcohol.
//
// The list is rendered TWICE and the track translates -50%, which is what makes
// the loop seamless: at -50% the second copy sits exactly where the first
// started, so the jump back to 0 is invisible. The copies must stay identical —
// if they ever drift apart the seam becomes obvious. The duplicate is
// aria-hidden so a screen reader reads the offer once.
//
// Motion, pause-on-hover and the reduced-motion opt-out live in lib/motion.js.

export default function Ticker({ items = [], label }) {
  if (!items.length) return null
  const run = (
    <>
      {items.map((t, i) => (
        <span key={i} className="bl-tick">
          <span aria-hidden className="bl-tick-dot" />
          {t}
        </span>
      ))}
    </>
  )

  return (
    <div className="bl-ticker" role="group" aria-label={label || 'What a seat gets you'}>
      <div className="bl-ticker-track">
        <span className="bl-ticker-run">{run}</span>
        <span className="bl-ticker-run" aria-hidden>{run}</span>
      </div>

      <style>{`
        .bl-ticker {
          background: linear-gradient(90deg, ${GOLD}, ${GOLD_HI} 45%, ${GOLD});
          border-top: 1px solid rgba(255,255,255,0.22);
          border-bottom: 1px solid rgba(10,10,11,0.18);
          padding: 13px 0;
        }
        .bl-ticker-run { display: flex; flex: 0 0 auto; }
        .bl-tick {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 0 22px;
          white-space: nowrap;
          color: ${ON_GOLD};
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .bl-tick-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: rgba(10,10,11,0.5);
          flex: 0 0 auto;
        }
      `}</style>
    </div>
  )
}
