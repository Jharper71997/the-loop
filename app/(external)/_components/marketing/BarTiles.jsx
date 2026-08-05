// The partner-bar tile grid, shared by / and /bars.
//
// The landing page shows the sign artwork; /bars shows the same tiles plus each
// bar's blurb. Previously /bars rendered a completely different object — an
// initials badge in a grey rounded box — so following "All 7 bars" from the
// homepage landed you somewhere that looked like another site.
//
// These are SIGNS and logos, not scenery, so each is contained on a dark plate
// rather than cropped edge-to-edge; `cover` sliced them into unreadable
// fragments ("RLE", "CHIES"). Only bars in PHOTO_BARS get cover.

import Link from 'next/link'
import { tileScrim } from '@/lib/atmosphere'

// Bars whose image is a real photograph (framed scenery) rather than a sign.
const PHOTO_BARS = new Set(['hideaway'])

export default function BarTiles({ bars = [], showBlurb = false, min = 210 }) {
  return (
    <>
      <div className="bl-mosaic" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
        {bars.map(b => {
          const isPhoto = PHOTO_BARS.has(b.slug)
          return (
            <Link key={b.slug} href={`/bars/${b.slug}`} className="bl-tile">
              <span className="bl-tile-art">
                {b.heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.heroImage} alt="" loading="lazy" style={{ objectFit: isPhoto ? 'cover' : 'contain' }} />
                ) : (
                  <span className="bl-tile-initials">{initials(b.name)}</span>
                )}
                <span aria-hidden className="bl-tile-scrim" style={{ background: tileScrim }} />
              </span>
              <span className="bl-tile-body">
                <span className="bl-tile-name">{b.name}</span>
                {showBlurb && b.blurb && <span className="bl-tile-blurb">{b.blurb}</span>}
                <span className="bl-tile-cta">View details &rarr;</span>
              </span>
            </Link>
          )
        })}
      </div>
      <style>{`
        .bl-mosaic { display: grid; gap: 12px; margin-top: 38px; }
        .bl-tile {
          position: relative; overflow: hidden; border-radius: 16px;
          text-decoration: none; display: flex; flex-direction: column;
          background: linear-gradient(170deg, #232329, #191920);
          border: 1px solid rgba(255,255,255,0.07);
          transition: transform .35s cubic-bezier(.2,.7,.3,1), border-color .35s;
        }
        .bl-tile:hover { transform: translateY(-4px); border-color: rgba(212,163,51,0.45); }
        .bl-tile:hover .bl-tile-art img { transform: scale(1.04); }

        .bl-tile-art {
          position: relative; display: block; width: 100%;
          aspect-ratio: 16 / 10; overflow: hidden;
          background:
            radial-gradient(70% 70% at 50% 40%, rgba(212,163,51,0.10), transparent 70%),
            #1b1b20;
        }
        .bl-tile-art img {
          width: 100%; height: 100%; display: block; padding: 12px;
          box-sizing: border-box;
          transition: transform .5s cubic-bezier(.2,.7,.3,1);
        }
        .bl-tile-scrim { position: absolute; inset: 0; pointer-events: none; opacity: .55; }
        .bl-tile-initials {
          position: absolute; inset: 0; display: grid; place-items: center;
          color: #d4a333; font-size: 30px; font-weight: 800; letter-spacing: .04em;
        }

        .bl-tile-body { position: relative; padding: 15px 17px 17px; display: flex; flex-direction: column; flex: 1; }
        .bl-tile-name {
          color: #f5f5f7; font-size: 17px; font-weight: 800;
          letter-spacing: -0.01em; display: block; line-height: 1.2;
        }
        .bl-tile-blurb {
          color: #b8b8bf; font-size: 13.5px; line-height: 1.55;
          margin-top: 8px; display: block;
        }
        .bl-tile-cta {
          color: #f0c24a; font-size: 13px; font-weight: 700;
          margin-top: auto; padding-top: 12px; display: block;
        }
      `}</style>
    </>
  )
}

// Fallback badge for a bar with no image (drops a leading "The", punctuation).
function initials(name) {
  const words = String(name).replace(/^the\s+/i, '').replace(/[^\w\s]/g, '').trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return words[0].slice(0, 2).toUpperCase()
}
