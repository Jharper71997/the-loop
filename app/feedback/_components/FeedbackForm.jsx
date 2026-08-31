'use client'

import { useState } from 'react'

// Light palette. This page deliberately does NOT use the app's black + gold
// rider chrome: a survey read one-handed on a phone in daylight is easier on
// white, and the form controls (checkbox, caret, autofill) render natively
// instead of needing to be fought. Gold survives as the accent only.
const INK = '#17181b'
const INK_SOFT = '#5c6066'
const INK_FAINT = '#8a8f95'
const HAIR = '#e6e5e1'
const GOLD = '#d4a333'
const GOLD_TEXT = '#8a6510'   // gold dark enough to read as text on white
const WASH = '#faf9f7'

const HEARD_OPTIONS = [
  'A friend told me',
  'Instagram or Facebook',
  'Saw the shuttle',
  'QR code at a bar',
  'Google',
  'Somewhere else',
]

const GROUP_OPTIONS = [
  'Friends',
  'Date night',
  'Birthday or bachelorette',
  'Work or team',
  'Military',
  'Visiting town',
]

const INTEREST_OPTIONS = [
  'Booking the whole shuttle',
  'A season pass',
  'Merch',
  'Bringing my company',
  'Being a stop on the route',
]

// Four screens: rate, the ride, about you, thanks.
//
// Ordered by what each answer costs the rider. Screen 1 is one tap and POSTs
// the moment it lands, because most riders will tap a star and close the tab —
// and a rating with no comment is still the number we manage against, so it has
// to be banked before the screen it was tapped on goes away. Screen 3 is the
// marketing half, marked optional and skippable, so it can never cost us the
// operational answers on screens 1 and 2.
//
// The Google review ask on the thank-you screen is shown to EVERY rider, not
// just the happy ones. Routing only 4-5 stars to Google is review gating, which
// violates Google's policy and gets the reviews filtered out. Low ratings get
// the "tell us what went wrong" box first instead, which is where an unhappy
// rider actually wants to go anyway.

// Identity is one of two things and never both: `token` is the per-ticket token
// minted by the morning-after cron, `publicToken` is a UUID the browser mints
// for the open /feedback link. Both are just a key for the same upsert — the
// open one buys no trust, which is why an open-link row carries no event and is
// reported separately.
export default function FeedbackForm({
  token = null,
  publicToken = null,
  requireContact = false,
  bars = [],
  firstName,
  knownEmail,
  existing,
  referralUrl,
  googleReviewUrl,
  brand = 'Brew Loop',
}) {
  const [step, setStep] = useState(existing?.rating ? 2 : 1)
  const [rating, setRating] = useState(existing?.rating || 0)
  const [driverRating, setDriverRating] = useState(existing?.driver_rating || 0)
  const [barsRating, setBarsRating] = useState(existing?.bars_rating || 0)
  const [timingRating, setTimingRating] = useState(existing?.timing_rating || 0)
  const [favoriteBar, setFavoriteBar] = useState(existing?.favorite_bar || '')
  const [rideAgain, setRideAgain] = useState(existing?.ride_again || '')
  const [comment, setComment] = useState(existing?.comment || '')
  const [groupType, setGroupType] = useState(existing?.group_type || '')
  const [heardAbout, setHeardAbout] = useState(existing?.heard_about || '')
  const [interests, setInterests] = useState(existing?.interests || [])
  const [nameInput, setNameInput] = useState(existing?.first_name || firstName || '')
  const [phone, setPhone] = useState(existing?.phone || '')
  const [email, setEmail] = useState(existing?.email || knownEmail || '')
  const [optIn, setOptIn] = useState(existing?.marketing_opt_in ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reviewCopied, setReviewCopied] = useState(false)

  async function save(patch, { advanceTo } = {}) {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, public_token: publicToken, ...patch }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save that')
      }
      if (advanceTo) {
        setStep(advanceTo)
        window.scrollTo({ top: 0 })
      }
    } catch (err) {
      setError(err.message || 'Could not save that')
    } finally {
      setSaving(false)
    }
  }

  function toggleInterest(opt) {
    setInterests(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt])
  }

  // ---------- 1. overall ----------
  if (step === 1) {
    return (
      <>
        <Step n={1} />
        <Q>Overall, how was it?</Q>
        <Stars rating={rating} onPick={n => { setRating(n); save({ rating: n }, { advanceTo: 2 }) }} disabled={saving} big />
        <p style={hintStyle}>1 = rough night. 5 = we nailed it.</p>
        {error && <ErrorLine>{error}</ErrorLine>}
      </>
    )
  }

  // ---------- 2. the ride ----------
  if (step === 2) {
    const unhappy = rating > 0 && rating <= 3
    return (
      <>
        <Step n={2} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30 }}>
          <Stars rating={rating} onPick={n => { setRating(n); save({ rating: n }) }} />
          <button type="button" onClick={() => setStep(1)} style={linkBtn}>change</button>
        </div>

        <Q>Rate the three things we can fix</Q>
        <div>
          <RatingRow label="Your driver" value={driverRating} onPick={setDriverRating} />
          <RatingRow label="The bar lineup" value={barsRating} onPick={setBarsRating} />
          <RatingRow label="Timing and waits" value={timingRating} onPick={setTimingRating} />
        </div>

        {bars.length > 0 && (
          <>
            <Q top>Favorite stop of the night?</Q>
            <Chips options={bars} value={favoriteBar} onChange={setFavoriteBar} />
          </>
        )}

        <Q top>Would you ride again?</Q>
        <Chips
          options={[
            { value: 'yes', label: 'Definitely' },
            { value: 'maybe', label: 'Maybe' },
            { value: 'no', label: 'Probably not' },
          ]}
          value={rideAgain}
          onChange={setRideAgain}
        />

        <Q top>{unhappy ? 'What went wrong?' : 'Anything we should know?'}</Q>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={4}
          placeholder={unhappy
            ? 'Tell us what happened. A real person reads this.'
            : 'The driver, the bars, the timing, anything.'}
          style={fieldStyle}
        />

        {error && <ErrorLine>{error}</ErrorLine>}

        <button
          type="button"
          disabled={saving}
          style={primaryBtn(saving)}
          onClick={() => save({
            rating,
            driver_rating: driverRating || null,
            bars_rating: barsRating || null,
            timing_rating: timingRating || null,
            favorite_bar: favoriteBar || null,
            ride_again: rideAgain || null,
            comment: comment.trim() || null,
          }, { advanceTo: 3 })}
        >
          {saving ? 'Saving…' : 'Next'}
        </button>
      </>
    )
  }

  // ---------- 3. about you (optional) ----------
  if (step === 3) {
    return (
      <>
        <Step n={3} />

        <h2 style={{ color: INK, fontSize: 21, margin: '0 0 6px', fontWeight: 650, letterSpacing: '-0.015em' }}>
          {requireContact ? 'Last bit. Who are we talking to?' : 'Last bit, and it is optional'}
        </h2>
        <p style={{ color: INK_SOFT, fontSize: 15, lineHeight: 1.55, margin: '0 0 30px' }}>
          {requireContact
            ? 'So we know who to get back to.'
            : 'This is the part that decides who we go after next. Skip it if you are done.'}
        </p>

        {requireContact && (
          <>
            <Q>First name</Q>
            <input
              type="text"
              autoComplete="given-name"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="First name"
              style={fieldStyle}
            />

            <Q top>Cell number</Q>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(910) 555 0134"
              style={fieldStyle}
            />
            <p style={{ ...hintStyle, textAlign: 'left', marginTop: 8 }}>
              We only use it to follow up on this ride.
            </p>
          </>
        )}

        <Q top={requireContact}>Who were you riding with?</Q>
        <Chips options={GROUP_OPTIONS} value={groupType} onChange={setGroupType} />

        <Q top>How did you first hear about us?</Q>
        <Chips options={HEARD_OPTIONS} value={heardAbout} onChange={setHeardAbout} />

        <Q top>Interested in any of these?</Q>
        <Chips options={INTEREST_OPTIONS} value={interests} onChange={toggleInterest} multi />

        {!knownEmail && (
          <>
            <Q top>Email{requireContact ? ' (optional)' : ''}</Q>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              style={fieldStyle}
            />
          </>
        )}

        <label style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginTop: 24, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={optIn}
            onChange={e => setOptIn(e.target.checked)}
            style={{ width: 19, height: 19, marginTop: 1, accentColor: GOLD, flex: '0 0 19px' }}
          />
          <span style={{ color: INK_SOFT, fontSize: 14.5, lineHeight: 1.5 }}>
            Text me when a new {brand} weekend goes on sale.
          </span>
        </label>

        {error && <ErrorLine>{error}</ErrorLine>}

        <button
          type="button"
          disabled={saving}
          style={primaryBtn(saving)}
          onClick={() => {
            // The open link earns nothing from an anonymous hand-raiser: a
            // "book the whole shuttle" with no number is a lead we cannot
            // return. So on that door the contact fields are the price of
            // finishing. The star is already banked from screen 1 either way,
            // so nobody bouncing here costs us the rating.
            if (requireContact) {
              if (!nameInput.trim()) return setError('We just need a first name.')
              if (digitsOf(phone).length < 10) return setError('That cell number looks incomplete.')
            }
            save({
              first_name: nameInput.trim() || null,
              phone: requireContact ? phone.trim() : null,
              group_type: groupType || null,
              heard_about: heardAbout || null,
              interests,
              email: email.trim() || null,
              marketing_opt_in: optIn,
            }, { advanceTo: 4 })
          }}
        >
          {saving ? 'Sending…' : 'Send it'}
        </button>
        {!requireContact && (
          <button
            type="button"
            onClick={() => { setStep(4); window.scrollTo({ top: 0 }) }}
            style={{ ...linkBtn, display: 'block', width: '100%', marginTop: 16, fontSize: 14, textAlign: 'center' }}
          >
            Skip this
          </button>
        )}
      </>
    )
  }

  // ---------- 4. thanks + the review ask ----------
  const unhappy = rating > 0 && rating <= 3
  const greetName = firstName || nameInput.trim()
  const hasComment = comment.trim().length > 0
  return (
    <>
      <h2 style={{ color: INK, fontSize: 26, margin: '0 0 10px', fontWeight: 650, letterSpacing: '-0.02em' }}>
        {unhappy ? 'Thank you. We are on it.' : `Thanks${greetName ? `, ${greetName}` : ''}.`}
      </h2>
      <p style={{ color: INK_SOFT, fontSize: 16, lineHeight: 1.6, margin: '0 0 34px' }}>
        {unhappy
          ? 'A real person reads every one of these. If yours needs a reply, you will get one.'
          : 'That is the whole survey. Two more things, if you have a second.'}
      </p>

      {googleReviewUrl ? (
        <Panel title="Leave us a Google review">
          <p style={panelCopy}>
            Say exactly what you told us above, good or bad. It is the single biggest thing that gets the next group on the shuttle.
          </p>
          {hasComment ? (
            // Google takes only a place id on the review URL — there is no
            // parameter that fills the box in for them, by design. The nearest
            // honest thing is to hand back their own words on the clipboard, in
            // the same tap that opens Google, so nobody types it twice.
            <p style={panelCopy}>
              Google will not let us fill the review in for you, so this copies what you already wrote. Paste it there and change whatever you want.
            </p>
          ) : null}
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              // Copy inside the click and deliberately do NOT await it. Awaiting
              // ends the user-gesture chain, and iOS Safari then treats the tab
              // that opens as an unrequested popup and blocks it.
              if (hasComment) {
                try {
                  navigator.clipboard?.writeText(comment.trim())
                  setReviewCopied(true)
                } catch { /* clipboard blocked — Google still opens, they just retype */ }
              }
              // Fire-and-forget — never block the tap through to Google on our own write.
              fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, public_token: publicToken, review_clicked: true }),
                keepalive: true,
              }).catch(() => {})
            }}
            style={{ ...primaryBtn(false), display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 0 }}
          >
            {hasComment ? 'Copy my words and review on Google' : 'Write a Google review'}
          </a>
          {reviewCopied ? (
            <p style={{ color: GOLD_TEXT, fontSize: 14, fontWeight: 600, textAlign: 'center', margin: '12px 0 0' }}>
              Copied. Paste it into the review box.
            </p>
          ) : null}
        </Panel>
      ) : null}

      {referralUrl && (
        <Panel title="Bring your people">
          <p style={panelCopy}>
            Send this to whoever missed out. Every friend who books off it puts you up the rider leaderboard.
          </p>
          <CopyLink url={referralUrl} />
        </Panel>
      )}

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <a href="/events" style={{ color: GOLD_TEXT, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
          See the next Loop →
        </a>
      </div>
    </>
  )
}

function Step({ n }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= n ? GOLD : HAIR }} />
        ))}
      </div>
      <div style={{ color: INK_FAINT, fontSize: 12.5, letterSpacing: '0.02em' }}>Step {n} of 3</div>
    </div>
  )
}

// Question heading. Plain sentence case in dark ink rather than a gold
// all-caps micro-label — on white the label style reads as decoration and the
// question stops looking like a question.
function Q({ children, top }) {
  return (
    <h3 style={{
      color: INK,
      fontSize: 17,
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.35,
      margin: top ? '34px 0 12px' : '0 0 14px',
    }}>
      {children}
    </h3>
  )
}

function RatingRow({ label, value, onPick }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '13px 0',
      borderBottom: `1px solid ${HAIR}`,
    }}>
      <span style={{ color: INK, fontSize: 15.5 }}>{label}</span>
      <Stars rating={value} onPick={onPick} />
    </div>
  )
}

function digitsOf(v) {
  return String(v || '').replace(/\D/g, '')
}

function CopyLink({ url }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          if (navigator.share) {
            await navigator.share({ url, title: 'Come ride the Brew Loop' })
            return
          }
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch { /* user dismissed the share sheet */ }
      }}
      style={{
        width: '100%',
        background: '#fff',
        border: `1px solid ${GOLD}`,
        color: GOLD_TEXT,
        borderRadius: 10,
        padding: '13px 14px',
        fontSize: 14.5,
        fontWeight: 600,
        cursor: 'pointer',
        wordBreak: 'break-all',
      }}
    >
      {copied ? 'Copied' : url.replace(/^https?:\/\//, '')}
    </button>
  )
}

function Stars({ rating, onPick, disabled, big }) {
  return (
    <div style={{ display: 'flex', gap: big ? 10 : 3, justifyContent: big ? 'center' : 'flex-end' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onPick(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            padding: big ? 2 : 1,
            fontSize: big ? 46 : 24,
            lineHeight: 1,
            cursor: disabled ? 'default' : 'pointer',
            color: n <= rating ? GOLD : '#dcdbd7',
            transition: 'color 0.12s',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// options: string[] or [{ value, label }]. `multi` turns it into a multi-select
// where onChange receives the single toggled option instead of the new value.
function Chips({ options, value, onChange, multi }) {
  const norm = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {norm.map(opt => {
        const active = multi ? (value || []).includes(opt.value) : value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(multi ? opt.value : (active ? '' : opt.value))}
            style={{
              padding: '11px 15px',
              borderRadius: 999,
              fontSize: 14.5,
              fontWeight: 500,
              cursor: 'pointer',
              background: active ? GOLD : '#fff',
              color: active ? '#17181b' : INK,
              border: `1px solid ${active ? GOLD : HAIR}`,
              fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div style={{ marginTop: 16, padding: 20, background: WASH, border: `1px solid ${HAIR}`, borderRadius: 14 }}>
      <h3 style={{ color: INK, fontSize: 16, fontWeight: 650, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function ErrorLine({ children }) {
  return (
    <p style={{ color: '#b3261e', fontSize: 14, margin: '16px 0 0', textAlign: 'center' }}>
      {children}
    </p>
  )
}

const hintStyle = { color: INK_FAINT, fontSize: 14, textAlign: 'center', margin: '18px 0 0' }
const panelCopy = { color: INK_SOFT, fontSize: 14.5, lineHeight: 1.6, margin: '0 0 16px' }

const linkBtn = {
  background: 'none', border: 'none', color: INK_FAINT, fontSize: 13,
  cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: 'inherit',
}

const fieldStyle = {
  width: '100%',
  background: '#fff',
  border: `1px solid ${HAIR}`,
  borderRadius: 10,
  color: INK,
  fontSize: 16,
  padding: '13px 14px',
  lineHeight: 1.5,
  resize: 'vertical',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function primaryBtn(disabled) {
  return {
    width: '100%',
    marginTop: 30,
    padding: '16px 20px',
    borderRadius: 12,
    border: 'none',
    background: disabled ? '#e8d5a6' : GOLD,
    color: '#17181b',
    fontSize: 16.5,
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }
}
