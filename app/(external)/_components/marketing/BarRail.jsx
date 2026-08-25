import Link from 'next/link'
import { GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, ON_GOLD, MAX_W } from '@/lib/marketingTheme'

// The bar rail — the landing page's showcase moment, after Jacob pointed at
// landonorris.com and asked for something like it. The partner bars laid out
// sideways and moved by vertical scroll, instead of a grid you take in at a
// glance and forget.
//
// This is deliberately NOT a replacement for BarTiles. `/bars` and `/about` are
// reference pages — someone is there to find a specific bar and its address, so
// a scannable grid is the right object and the rail would actively get in the
// way. The rail is for the one page whose job is to make you want to come.
//
// The pin, the sideways travel, the progress fill and the drift inside each
// card all live in `@supports (animation-timeline: view())` in lib/motion.js.
// Where that's unsupported this renders as a plain horizontal scroller with
// snap points, which is a good phone control on its own — the section is never
// pinned by a browser that can't also move it, because a panel you can't scroll
// past is worse than no effect at all.
//
// THE CARDS ARE POSTERS, not tiles with a caption bolted underneath. The first
// build put the sign on a plate and stacked number/name/blurb in a body block
// below it, which is the same object as every other card on the internet and
// Jacob called it boring. Now the artwork fills the whole card and the type
// sits on it under a scrim, so what you scroll past is eight pieces of real
// signage rather than eight rectangles of UI.
//
// Signs stay `contain`, never `cover`: cropping them slices the words into
// unreadable fragments ("RLE", "CHIES").

export default function BarRail({ bars = [], eyebrow, title }) {
  if (!bars.length) return null

  return (
    <div className="bl-rail-pin">
      <div className="bl-rail-stick">
        {/* The heading rides INSIDE the pinned area. Left in the section above,
            it scrolls away before the rail starts moving, and you spend the
            whole pin looking at unlabelled cards in the middle of an empty
            screen. */}
        <div className="bl-rail-head">
          <div>
            {eyebrow && <div className="bl-rail-eyebrow">{eyebrow}</div>}
            {title && <h2 className="bl-rail-title">{title}</h2>}
          </div>
          <Link href="/bars" className="bl-rail-all">All {bars.length} bars</Link>
        </div>

        {/* How far through the route you are. Hidden by default and revealed
            only inside the @supports block — a progress bar that can never
            fill is a broken-looking decoration. */}
        <div className="bl-rail-prog" aria-hidden>
          <span className="bl-rail-prog-track">
            <span className="bl-rail-prog-fill" />
          </span>
        </div>

        <div className="bl-rail-viewport">
          <div className="bl-rail-track">
            {bars.map((b, i) => (
              <Link key={b.slug} href={`/bars/${b.slug}`} className="bl-rail-card">
                <span className="bl-rail-frame">
                  <span className="bl-rail-art">
                    {b.heroImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.heroImage} alt="" loading="lazy" />
                    ) : (
                      <span className="bl-rail-initials">{initials(b.name)}</span>
                    )}
                  </span>
                  <span aria-hidden className="bl-rail-scrim" />
                  <span aria-hidden className="bl-rail-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="bl-rail-meta">
                    <span className="bl-rail-name">{b.name}</span>
                    {/* The street, not the neighbourhood — every one of these
                        is "Jacksonville, NC", which tells a local nothing.
                        "Gum Branch Rd" tells them exactly where it is. */}
                    {street(b.address) && <span className="bl-rail-street">{street(b.address)}</span>}
                  </span>
                </span>
              </Link>
            ))}

            {/* Trailing card: the rail should end on somewhere to go, not on
                the last bar with nothing after it. Gold, because it's the one
                card that is an action rather than a place. */}
            <Link href="/bars" className="bl-rail-card bl-rail-end">
              <span className="bl-rail-frame bl-rail-end-frame">
                <span className="bl-rail-end-k">The whole route</span>
                <span className="bl-rail-end-t">All {bars.length} partner bars</span>
                <span className="bl-rail-end-go">See them all &rarr;</span>
              </span>
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .bl-rail-head {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-end;
          justify-content: space-between;
          max-width: ${MAX_W}px;
          margin: 0 auto;
          padding: 0 24px;
          width: 100%;
          box-sizing: border-box;
        }
        .bl-rail-eyebrow {
          color: ${GOLD};
          font-size: 11px; font-weight: 700; letter-spacing: 0.22em;
          text-transform: uppercase;
        }
        .bl-rail-title {
          color: ${INK};
          font-size: clamp(26px, 3.6vw, 42px);
          font-weight: 800; letter-spacing: -0.025em; line-height: 1.08;
          margin: 12px 0 0;
          max-width: 620px;
        }
        .bl-rail-all {
          color: ${INK_DIM};
          font-size: 14px; font-weight: 700;
          text-decoration: none;
          padding: 12px 20px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 999px;
          white-space: nowrap;
          transition: color .3s, border-color .3s, background .3s;
        }
        .bl-rail-all:hover {
          color: ${GOLD_HI};
          border-color: rgba(212,163,51,0.45);
          background: rgba(212,163,51,0.07);
        }

        /* ---- progress ---- */
        .bl-rail-prog {
          max-width: ${MAX_W}px;
          margin: 0 auto;
          width: 100%;
          padding: 0 24px;
          box-sizing: border-box;
        }
        .bl-rail-prog-track {
          display: block; height: 2px; border-radius: 2px; overflow: hidden;
          background: rgba(255,255,255,0.10);
        }
        .bl-rail-prog-fill {
          display: block; height: 100%; border-radius: 2px;
          transform-origin: left center;
          transform: scaleX(0.04);
          background: linear-gradient(90deg, ${GOLD}, ${GOLD_HI});
          box-shadow: 0 0 14px rgba(212,163,51,0.55);
        }

        /* ---- the poster ---- */
        .bl-rail-card {
          width: clamp(248px, 27vw, 340px);
          text-decoration: none;
          display: block;
        }
        .bl-rail-frame {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 4 / 5;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.09);
          /* The plate has to be DARKER than the surrounding band, not lighter.
             Several of these signs are photographed with black baked into the
             image (Black Rose, Unhinged) — on a lifted grey plate that black
             shows up as a hard rectangle sitting inside the card. Dropping the
             plate to near-black lets those blend into it, while the signs shot
             on colour still pop. The gold pooling at the top is what keeps it
             from being a flat hole. */
          background:
            radial-gradient(88% 52% at 50% 0%, rgba(212,163,51,0.22), transparent 72%),
            linear-gradient(180deg, #191920, #0d0d11);
          box-shadow: 0 24px 54px rgba(0,0,0,0.5);
          transition: transform .45s cubic-bezier(.2,.7,.3,1),
                      border-color .45s, box-shadow .45s;
        }
        .bl-rail-card:hover .bl-rail-frame {
          transform: translateY(-8px);
          border-color: rgba(212,163,51,0.5);
          box-shadow: 0 34px 70px rgba(0,0,0,0.6);
        }

        /* The artwork sits in the TOP portion of the poster so the type at the
           bottom never lands on top of the sign's own lettering. */
        /* The art owns everything above the caption. The first pass reserved
           only the top 66% for it, which left a band of empty plate between a
           wide sign and its name — a hole in the middle of every card. */
        .bl-rail-art {
          position: absolute;
          inset: 0 0 24% 0;
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .bl-rail-art img {
          max-width: 100%;
          max-height: 100%;
          width: auto; height: auto;
          object-fit: contain;
          padding: 30px 24px 0;
          box-sizing: border-box;
          display: block;
        }
        .bl-rail-initials {
          color: ${GOLD};
          font-size: 38px; font-weight: 800; letter-spacing: 0.04em;
        }

        .bl-rail-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 52%, rgba(10,10,13,0.70) 74%, rgba(10,10,13,0.95) 100%);
          pointer-events: none;
        }

        /* The index as a big outlined numeral. Where -webkit-text-stroke is
           unsupported this falls back to the faint gold fill underneath it,
           which is the same idea a shade quieter. */
        .bl-rail-idx {
          position: absolute;
          top: 14px; left: 18px;
          font-size: clamp(46px, 5.4vw, 68px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
          color: rgba(212,163,51,0.16);
          -webkit-text-stroke: 1px rgba(212,163,51,0.42);
          pointer-events: none;
        }

        .bl-rail-meta {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          display: block;
          padding: 0 20px 20px;
        }
        .bl-rail-name {
          display: block;
          color: ${INK};
          font-size: clamp(18px, 2vw, 22px);
          font-weight: 800; letter-spacing: -0.015em; line-height: 1.15;
          text-shadow: 0 2px 14px rgba(0,0,0,0.6);
        }
        .bl-rail-street {
          display: block;
          color: ${INK_MUTE};
          font-size: 13px; font-weight: 600;
          margin-top: 6px;
          transition: color .3s;
        }
        .bl-rail-card:hover .bl-rail-street { color: ${GOLD_HI}; }

        /* ---- the closing card ---- */
        .bl-rail-end-frame {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          gap: 8px;
          padding: 26px 24px;
          background: linear-gradient(168deg, ${GOLD_HI}, ${GOLD});
          border-color: rgba(255,255,255,0.28);
        }
        .bl-rail-end-k {
          color: rgba(10,10,11,0.62);
          font-size: 11px; font-weight: 800; letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .bl-rail-end-t {
          color: ${ON_GOLD};
          font-size: clamp(22px, 2.4vw, 28px);
          font-weight: 800; letter-spacing: -0.02em; line-height: 1.1;
        }
        .bl-rail-end-go {
          color: rgba(10,10,11,0.78);
          font-size: 14.5px; font-weight: 800;
          margin-top: 6px;
        }
      `}</style>
    </div>
  )
}

function initials(name = '') {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

// "1202 Gum Branch Rd, Jacksonville, NC 28540" -> "Gum Branch Rd".
// Returns null rather than a half-parsed string if the address isn't in that
// shape, so a bad row drops the line instead of printing something wrong.
function street(address = '') {
  const first = String(address || '').split(',')[0]?.trim()
  if (!first) return null
  const withoutNumber = first.replace(/^\d+[a-zA-Z]?\s+/, '').trim()
  const cleaned = withoutNumber.replace(/\s+(suite|ste|unit|#)\s*\S+$/i, '').trim()
  return cleaned.length > 2 ? cleaned : null
}
