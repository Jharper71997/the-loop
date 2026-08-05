// Shared shell for every Brew Loop marketing page.
//
// Before this, each page invented its own hero (same HERO_GLOW radial on flat
// black), its own section padding, and its own heading sizes — so moving from /
// to /about to /bars felt like three different websites stapled together. The
// landing page then got rebuilt around real photography + lib/atmosphere, which
// widened the gap instead of closing it.
//
// These are the landing page's own shapes, extracted so the other pages can use
// them verbatim:
//
//   PageHero  photograph + scrim + grain + pill + headline + actions + facts
//   Band      a toned section with light pooling from a named direction
//   Head      eyebrow + h2 (+ sub) (+ an aside action on the right)
//
// Server-safe (no 'use client') so page.js files can render them directly.

import Link from 'next/link'
import {
  GOLD_HI, INK, INK_DIM, INK_MUTE, LINE_HI, MAX_W,
} from '@/lib/marketingTheme'
import { TONES, grainOverlay, lightPool, photoScrim, fadeRule } from '@/lib/atmosphere'

/* ================================= HERO ================================== */
/* Same construction as the landing hero: an image carries the section, the
   scrim keeps the copy legible, grain stops the dark half from banding.      */

export function PageHero({
  kicker,
  title,
  sub,
  actions,
  facts,
  image,
  position = 'center',
  children,
}) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: TONES.void }}>
      {image ? (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: position,
          }}
        />
      ) : (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-left', 0.2) }} />
      )}
      {image && <div aria-hidden style={{ position: 'absolute', inset: 0, background: photoScrim }} />}
      <div aria-hidden style={grainOverlay} />

      <div style={{
        position: 'relative', maxWidth: MAX_W, margin: '0 auto',
        padding: image
          ? 'clamp(64px, 10vw, 120px) 24px clamp(52px, 7vw, 88px)'
          : 'clamp(56px, 8vw, 96px) 24px clamp(44px, 6vw, 72px)',
      }}>
        <div style={{ maxWidth: 760 }}>
          {kicker && <span style={heroPill}><span style={dot} /> {kicker}</span>}

          <h1 style={{
            color: INK, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02,
            fontSize: 'clamp(36px, 6.4vw, 68px)', margin: '20px 0 0',
            textShadow: image ? '0 4px 40px rgba(0,0,0,0.6)' : undefined,
          }}>
            {title}
          </h1>

          {sub && (
            <p style={{
              color: image ? '#d9d9de' : INK_DIM,
              fontSize: 'clamp(15px, 1.7vw, 19px)', lineHeight: 1.55,
              margin: '18px 0 0', maxWidth: 580,
              textShadow: image ? '0 2px 20px rgba(0,0,0,0.7)' : undefined,
            }}>
              {sub}
            </p>
          )}

          {actions && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30, alignItems: 'center' }}>
              {actions}
            </div>
          )}

          {facts && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 28, color: INK_MUTE, fontSize: 13.5, fontWeight: 600 }}>
              {facts.map((f, i) => (
                <span key={f} style={{ display: 'inline-flex', gap: 18, alignItems: 'center' }}>
                  {i > 0 && <span aria-hidden style={{ opacity: 0.4 }}>/</span>}
                  {f}
                </span>
              ))}
            </div>
          )}

          {children}
        </div>
      </div>
    </section>
  )
}

/* ================================= BAND ================================== */
/* Consecutive sections must not be the same value — that was what made the
   old pages read as one endless box. `tone` + `light` vary the room.         */

export function Band({
  tone = 'base',
  light = null,
  strength = 0.12,
  grain = false,
  rule = false,
  id,
  children,
  width = MAX_W,
  tight = false,
}) {
  return (
    <section
      id={id}
      style={{ position: 'relative', overflow: 'hidden', background: TONES[tone] || TONES.base, scrollMarginTop: 72 }}
    >
      {rule && <hr style={fadeRule} />}
      {light && <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool(light, strength) }} />}
      {grain && <div aria-hidden style={grainOverlay} />}
      <div style={{
        position: 'relative', maxWidth: width, margin: '0 auto',
        padding: tight ? 'clamp(40px, 6vw, 68px) 24px' : 'clamp(56px, 8vw, 100px) 24px',
      }}>
        {children}
      </div>
    </section>
  )
}

/* ================================= HEAD ================================== */

export function Head({ kicker, title, sub, aside }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <div style={{ maxWidth: 620 }}>
        {kicker && <div style={kickerStyle}>{kicker}</div>}
        <h2 style={h2}>{title}</h2>
        {sub && (
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.6, margin: '14px 0 0' }}>
            {sub}
          </p>
        )}
      </div>
      {aside}
    </div>
  )
}

/* ============================== Closing CTA ============================== */
/* One shape, used at the bottom of every page, so "what do I do next" always
   looks the same no matter where you stopped reading.                        */

export function Closer({ title, sub, cta = { href: '/events', label: 'Book a seat' }, secondary }) {
  return (
    <Band tone="void" light="bottom" strength={0.2} grain rule>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ ...h2, margin: '0 auto', maxWidth: 640 }}>{title}</h2>
        {sub && (
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.55, margin: '18px auto 0', maxWidth: 520 }}>
            {sub}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 30 }}>
          <Link href={cta.href} style={{ ...ctaPrimary }}>{cta.label}</Link>
          {secondary}
        </div>
      </div>
    </Band>
  )
}

/* ============================== Shared type ============================== */

export const h2 = {
  color: INK, fontSize: 'clamp(27px, 4.4vw, 44px)', fontWeight: 800,
  letterSpacing: '-0.025em', lineHeight: 1.06, margin: '14px 0 0', maxWidth: 640,
}

export const kickerStyle = {
  color: '#d4a333', fontSize: 11, letterSpacing: '0.2em',
  textTransform: 'uppercase', fontWeight: 700,
}

export const heroPill = {
  display: 'inline-flex', alignItems: 'center', gap: 9,
  padding: '8px 15px', borderRadius: 999, border: '1px solid rgba(212,163,51,0.35)',
  background: 'rgba(10,10,11,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  color: GOLD_HI, fontSize: 11.5, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
}

const dot = {
  width: 8, height: 8, borderRadius: '50%', background: '#d4a333',
  boxShadow: '0 0 10px #d4a333', display: 'inline-block', flex: '0 0 auto',
}

const ctaPrimary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '17px 34px', borderRadius: 12,
  background: 'linear-gradient(180deg, #f0c24a, #d4a333)', color: '#0a0a0b',
  fontWeight: 800, fontSize: 17, textDecoration: 'none', border: 'none',
  boxShadow: '0 10px 28px rgba(212,163,51,0.28)',
}

/* A pill that sits on a hero photo — used for "next loop" style chips. */
export function GlassChip({ children, href }) {
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none',
    padding: '13px 18px', borderRadius: 999,
    background: 'rgba(10,10,11,0.55)', border: `1px solid ${LINE_HI}`,
    color: INK, fontSize: 14, fontWeight: 700,
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  }
  return href ? <Link href={href} style={style}>{children}</Link> : <span style={style}>{children}</span>
}
