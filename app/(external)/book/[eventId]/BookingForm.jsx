'use client'

import { useEffect, useMemo, useState } from 'react'
import { prefixLink } from '@/lib/businessConfig'
import { captureAttribution } from '@/lib/attribution'
import ConsentCheckbox, { PolicyLink, SmsConsentLabel } from '@/app/_components/legal/ConsentCheckbox'
import { DOOR_PICKUP_MIN_RIDERS, DOOR_PICKUP_MAX_RIDERS, zoneOfTicketType, zipProblem, zonesForZip, normalizeZip, BASE_ZONE, BASE_ID_TEXT } from '@/lib/doorPickup'

// Leaflet touches window, and only door pickup riders who open it need it.

const ACCENT = '#d4a333'
// Lifted (Jacob, 2026-09-29: too dark to read the details).
const SURFACE = '#2a2a31'
const BORDER = '#3c3c45'

// fareLabel / fareHint let a caller relabel the ticket chooser. The defaults
// are the public loop's words, where a ticket IS a pickup bar and the rider has
// to be told to pick the one they will already be at. On a private party that
// is nonsense — the shuttle collects them from their own front door — so
// /party/[token] passes its own copy rather than asking a charter organizer
// which bar they would like to be picked up at.
export default function BookingForm({
  eventId, eventName, ticketTypes, addons = [], stops = [], waiver,
  fareLabel = null, fareHint = null,
  // Rider age rule printed in the Terms checkbox. The bar loops (Brew, Surf)
  // are 21+; pass null for a service without one (The Loop / Marines, and
  // door pickup, which is all ages).
  minAge = 21,
  // Business name printed in the SMS consent (Brew / Surf / The Loop).
  brandName = undefined,
  // Brew Loop only: explain how a Loop Pass is applied. The discount happens
  // server-side, so without this a member sees full price and assumes it failed.
  loopPass = false,
  // Door pickup (lib/doorPickup.js): the group picks ONE departure slot and is
  // collected from their own address, which has to sit in that slot's zone.
  doorPickup = false,
  // Door pickup, joining someone's group: { code, slotId, organizer, street, city }.
  joinParty = null,
  // Door pickup: { stop, left } Brew Loop seats that night. Anyone riding it
  // is taken to that stop (Angry Ginger) and holds one of its seats.
  brewLoopSeats = null,
}) {
  // A walk-on ticket type carries no bar (stop_index null). When the rider picks
  // one we make them choose a pickup bar from the night's list so the driver and
  // security know where to get them.
  const isWalkOn = tt => !!tt && tt.stop_index == null
  const needsPickup = tt => isWalkOn(tt) && stops.length > 0
  // Default to the first ticket type that still has seats. If everything is
  // sold out we fall back to the first one anyway so the form renders — the
  // submit button will be disabled by the oversell check below.
  const defaultTtId = joinParty?.slotId
    || (ticketTypes.find(t => (t.remaining ?? Infinity) > 0) || ticketTypes[0])?.id || ''

  const [attribution, setAttribution] = useState(null)
  const [bartenderCode, setBartenderCode] = useState('')
  // Seller / QR / UTM tags. lib/attribution keeps them for a week across pages
  // (AttributionCapture in the layout stores them on landing); this re-reads
  // on mount so a tag on the /book URL itself counts too.
  useEffect(() => { setAttribution(captureAttribution()) }, [])

  const [buyer, setBuyer] = useState({
    // Ride-text consent starts UNCHECKED (TCPA express consent: the rider has to
    // opt in themselves, and it is never a condition of buying).
    first_name: joinParty?.seat?.first_name || '', last_name: joinParty?.seat?.last_name || '',
    email: '', phone: joinParty?.seat?.phone || '', sms_consent: false,
  })
  // Organizer of a door pickup: must list at least 4 riders, and for each
  // friend chooses to pay for them or send them a link to pay their own.
  const organizer = doorPickup && !joinParty
  // Terms / Privacy / Refund agreement (plus the age rule on the bar loops).
  // Required to pay, never pre-ticked.
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [riders, setRiders] = useState(() => [
    {
      ticket_type_id: defaultTtId,
      first_name: '', last_name: '', email: '', phone: '',
      same_as_buyer: true,
      // Door pickup organizer signs the waiver once for the whole group.
      signed_self: !(doorPickup && !joinParty),
      signed_by_buyer: doorPickup && !joinParty,
      claim_link: false,
      typed_name: '',
      pickup_stop_index: '',
    },
    ...Array.from({ length: doorPickup && !joinParty ? DOOR_PICKUP_MIN_RIDERS - 1 : 0 }, () => newGroupRider(defaultTtId)),
  ])
  const [pickupAddress, setPickupAddress] = useState({ street: '', city: 'Jacksonville', zip: '', notes: '' })
  // Riders never pick a zone. The ZIP decides it (28544 also asks "on base?")
  // and only that zone's times are shown. slotPicked stops the default first
  // ticket type from counting as a choice.
  const [onBase, setOnBase] = useState(null)
  const [slotPicked, setSlotPicked] = useState(false)
  const [baseIdAck, setBaseIdAck] = useState(false)
  // null = not answered yet. The organizer has to answer, even if it is 0.
  const [brewLoopRiders, setBrewLoopRiders] = useState(null)
  const doorSlot = doorPickup ? ticketTypes.find(t => t.id === riders[0]?.ticket_type_id) : null
  const doorZone = doorSlot ? zoneOfTicketType(doorSlot) : null
  const zipValid = !!normalizeZip(pickupAddress.zip)
  const zipZones = doorPickup ? zonesForZip(pickupAddress.zip) : []
  const riderZone = zipZones.length === 1 ? zipZones[0]
    : zipZones.length > 1 && onBase != null
      ? (onBase ? BASE_ZONE : zipZones.find(z => z !== BASE_ZONE))
      : null
  const riderSlots = riderZone ? ticketTypes.filter(t => zoneOfTicketType(t) === riderZone) : []
  const slotReady = slotPicked && riderZone != null && doorZone === riderZone

  // One slot for the whole group.
  function setDoorSlot(ttId) {
    setRiders(prev => prev.map(r => ({ ...r, ticket_type_id: ttId })))
  }
  // Add-on quantities, keyed by addon id. Default everything to 0 (opt-in).
  const [addonQty, setAddonQty] = useState(() =>
    Object.fromEntries((addons || []).map(a => [a.id, 0])))
  const [buyerTypedName, setBuyerTypedName] = useState('')
  const [waiverOpen, setWaiverOpen] = useState(false)
  const [bartenderOpen, setBartenderOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Stable per-attempt token so a double-tap or network retry of Pay replays
  // the same Stripe URL instead of creating a duplicate order. Rotated after
  // a failed submit so the next manual click starts a fresh attempt.
  const [clientToken, setClientToken] = useState(() => mintToken())

  const ticketCents = useMemo(() => riders.reduce((s, r) => {
    const tt = ticketTypes.find(t => t.id === r.ticket_type_id)
    return r.pay_self ? s : s + (tt?.price_cents || 0)
  }, 0), [riders, ticketTypes])

  const addonCents = useMemo(() => (addons || []).reduce(
    (s, a) => s + (a.price_cents || 0) * (addonQty[a.id] || 0), 0), [addons, addonQty])

  // What the buyer sees. A Loop Pass may cover some seats server-side, so the
  // amount actually charged can be lower — the server is the source of truth.
  const totalCents = ticketCents + addonCents

  function updateRider(idx, patch) {
    setRiders(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function addRider() {
    setRiders(prev => {
      if (doorPickup && prev.length >= DOOR_PICKUP_MAX_RIDERS) return prev
      return [...prev, newGuest(doorPickup ? prev[0].ticket_type_id : defaultTtId, organizer)]
    })
  }

  // Door pickup organizer: the group size drives the rider list.
  function setGroupSize(n) {
    const size = Math.max(DOOR_PICKUP_MIN_RIDERS, Math.min(DOOR_PICKUP_MAX_RIDERS, n))
    setRiders(prev => size <= prev.length
      ? prev.slice(0, size)
      : [...prev, ...Array.from({ length: size - prev.length }, () => newGroupRider(prev[0].ticket_type_id))])
  }

  function removeRider(idx) {
    setRiders(prev => prev.filter((_, i) => i !== idx))
  }

  function setAddon(id, qty) {
    setAddonQty(prev => ({ ...prev, [id]: Math.max(0, Math.min(20, qty)) }))
  }

  // Per-ticket-type request count → use to disable Pay when the rider has
  // chosen more of one ticket type than there are seats remaining (server
  // also enforces this, but blocking client-side prevents a wasted submit).
  const requestedByTt = useMemo(() => {
    const m = new Map()
    for (const r of riders) {
      if (!r.ticket_type_id) continue
      m.set(r.ticket_type_id, (m.get(r.ticket_type_id) || 0) + 1)
    }
    return m
  }, [riders])

  const oversellError = useMemo(() => {
    for (const [ttId, want] of requestedByTt.entries()) {
      const t = ticketTypes.find(x => x.id === ttId)
      if (!t || t.remaining == null) continue
      if (want > t.remaining) {
        if (t.remaining === 0) return `${t.name} is sold out — please pick a different pickup.`
        return `Only ${t.remaining} seat${t.remaining === 1 ? '' : 's'} left at ${t.name}. Remove a rider or change their pickup.`
      }
    }
    return null
  }, [requestedByTt, ticketTypes])

  const soldOutTypes = useMemo(
    () => ticketTypes.filter(t => t.remaining === 0),
    [ticketTypes])

  const buyerOwesSig = riders.some(r => r.signed_by_buyer)
  const formValid = useMemo(() => {
    if (!buyer.first_name || !buyer.last_name) return false
    if (!buyer.phone && !buyer.email) return false
    if (!ticketTypes.length) return false
    if (oversellError) return false
    for (const r of riders) {
      if (!r.ticket_type_id) return false
      // A friend paying through their own link: we only need who they are.
      if (r.pay_self) {
        if (!r.first_name.trim() || r.phone.replace(/\D/g, '').length < 10) return false
        continue
      }
      // Walk-on riders must pick a pickup bar (applies even to claim-link seats
      // — the buyer chooses where their friend boards).
      const tt = ticketTypes.find(t => t.id === r.ticket_type_id)
      const walkOn = tt && tt.stop_index == null
      if (walkOn && stops.length > 0 && (r.pickup_stop_index === '' || r.pickup_stop_index == null)) return false
      // claim_link riders skip name + contact + waiver — that's the whole point
      if (r.claim_link) continue
      if (!r.same_as_buyer && (!r.first_name.trim() || (!r.last_name.trim() && !organizer))) return false
      if (!r.same_as_buyer && !r.phone && !r.email && !organizer) return false
      if (r.signed_self && !r.typed_name.trim()) return false
    }
    if (buyerOwesSig && !buyerTypedName.trim()) return false
    if (!termsAccepted) return false
    if (doorPickup) {
      if (riders.length > DOOR_PICKUP_MAX_RIDERS) return false
      if (organizer && riders.length < DOOR_PICKUP_MIN_RIDERS) return false
      if (organizer && riders.filter(r => !r.pay_self).length < DOOR_PICKUP_MIN_RIDERS) return false
      if (doorZone === BASE_ZONE && !baseIdAck) return false
      if (!joinParty) {
        if (brewLoopSeats && (brewLoopRiders == null || brewLoopRiders > riders.length || brewLoopRiders > brewLoopSeats.left)) return false
        if (!pickupAddress.street.trim() || !pickupAddress.city.trim()) return false
        if (!slotReady || zipProblem(pickupAddress.zip, doorZone)) return false
      }
    }
    return true
  }, [buyer, riders, ticketTypes, stops, buyerOwesSig, buyerTypedName, oversellError, termsAccepted, doorPickup, joinParty, pickupAddress, doorZone, baseIdAck, brewLoopRiders, brewLoopSeats, slotReady])

  async function onSubmit(e) {
    e.preventDefault()
    if (!formValid || submitting) return
    setSubmitting(true)
    setError(null)

    const ridersPayload = riders.map(r => {
      if (r.pay_self) {
        return {
          ticket_type_id: r.ticket_type_id, pay_self: true,
          first_name: r.first_name.trim(), last_name: r.last_name.trim(), phone: r.phone.trim(),
        }
      }
      // Walk-on pickup bar → numeric stop index (null for normal per-bar tickets).
      const ttSel = ticketTypes.find(t => t.id === r.ticket_type_id)
      const pickupStopIndex = (ttSel && ttSel.stop_index == null && r.pickup_stop_index !== '' && r.pickup_stop_index != null)
        ? Number(r.pickup_stop_index)
        : null
      // Claim-link riders: no contact info collected; checkout mints a token
      // the buyer can forward to the friend. Friend fills info + signs at /c/<token>.
      if (r.claim_link) {
        return {
          ticket_type_id: r.ticket_type_id,
          claim_link: true,
          pickup_stop_index: pickupStopIndex,
        }
      }
      const baseRider = r.same_as_buyer
        ? {
            first_name: buyer.first_name,
            last_name: buyer.last_name,
            email: buyer.email,
            phone: buyer.phone,
          }
        : {
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            phone: r.phone,
          }
      return {
        ...baseRider,
        ticket_type_id: r.ticket_type_id,
        signed_self: !!r.signed_self,
        signed_by_buyer: !!r.signed_by_buyer,
        typed_name: r.signed_self ? r.typed_name.trim() : '',
        pickup_stop_index: pickupStopIndex,
      }
    })

    // Bartender code, if typed, rides on attribution. Server resolves it
    // case-insensitively against bartenders.share_code → slug.
    const bartenderCodeTrim = bartenderCode.trim()
    const submittedAttribution = bartenderCodeTrim
      ? { ...(attribution || {}), bartender_code: bartenderCodeTrim }
      : attribution

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          buyer,
          riders: ridersPayload,
          addons: Object.entries(addonQty)
            .filter(([, q]) => q > 0)
            .map(([addon_id, quantity]) => ({ addon_id, quantity })),
          buyer_typed_name: buyerTypedName.trim(),
          attribution: submittedAttribution,
          client_token: clientToken,
          ...(doorPickup && joinParty ? { join_code: joinParty.code, seat_token: joinParty.seat?.token || null } : {}),
          ...(doorPickup && !joinParty ? { pickup_address: pickupAddress, brew_loop_riders: brewLoopRiders || 0 } : {}),
          ...(doorPickup && doorZone === BASE_ZONE ? { base_id_ack: baseIdAck } : {}),
          terms_accepted: termsAccepted,
          age_confirmed: !!minAge && termsAccepted,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.checkout_url) {
        // Default to a friendly, generic message. Raw server codes
        // (checkout_failed, order_insert_failed, etc.) are for diagnosis, not
        // for the rider — log them to the console instead of showing them.
        let message = 'Something went wrong starting checkout. Please try again.'
        if (json.error === 'sold_out') {
          const remaining = json.remaining ?? 0
          message = remaining > 0
            ? `Only ${remaining} ${json.ticket_type_name || 'ticket'}${remaining === 1 ? '' : 's'} left — please remove a rider or pick a different ticket.`
            : `Sold out: ${json.ticket_type_name || 'this ticket'} is fully booked.`
        } else if (json.error === 'in_flight_retry') {
          message = 'Hang on — finalizing your previous attempt. Try again in a few seconds.'
        } else if (json.error === 'terms_not_accepted') {
          message = 'Please tick the box agreeing to the Terms before you pay.'
        } else if (json.error === 'pickup_required') {
          message = 'Please choose a pickup stop for your walk-on ticket.'
        } else if (json.error === 'verification_required') {
          // The Loop (Marines): not cleared, or the verify cookie expired. Send
          // them to verify with their DoD ID, then back to buying.
          window.location.href = prefixLink('/verify', 'marines')
          return
        } else if (json.error === 'brew_loop') {
          message = json.message || 'Please check how many are riding the Brew Loop.'
        } else if (json.error === 'pickup_address') {
          message = json.message || 'Please check your pickup address.'
        } else if (json.error === 'group_size') {
          message = `A booking holds up to ${DOOR_PICKUP_MAX_RIDERS} riders.`
        } else if (json.error === 'seat_already_paid') {
          message = 'This seat is already paid for. You’re all set.'
        } else if (json.error === 'min_paid') {
          message = `You pay for at least ${DOOR_PICKUP_MIN_RIDERS} seats. Only riders past ${DOOR_PICKUP_MIN_RIDERS} can pay their own.`
        } else if (json.error === 'duplicate_rider') {
          message = `Each friend needs their own phone number. Groups need ${DOOR_PICKUP_MIN_RIDERS} different people.`
        } else if (json.error === 'pay_self_contact') {
          message = 'Add a first name and phone for each friend paying their own seat.'
        } else if (json.error === 'base_id_required') {
          message = 'On base pickups need every adult to have a military or dependent ID. Check the box to confirm.'
        } else if (json.error === 'join_invalid') {
          message = 'That group link isn’t valid anymore. Ask whoever sent it for a new one, or book your own pickup.'
        } else if (json.error === 'pass_verify_failed') {
          message = json.message
        } else if (json.error) {
          console.error('[checkout] server error:', json.error, json)
        }
        setError(message)
        setSubmitting(false)
        if (json.error !== 'in_flight_retry') setClientToken(mintToken())
        return
      }
      window.location.href = json.checkout_url
    } catch (err) {
      // Network failure or an empty/non-JSON response body. Never show the raw
      // JS message ("Unexpected end of JSON input") to a rider.
      console.error('[checkout] request failed', err)
      setError('Something went wrong reaching checkout. Please try again.')
      setSubmitting(false)
      setClientToken(mintToken())
    }
  }

  if (!ticketTypes.length) {
    return (
      <div style={{ padding: 16, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, color: '#bbb' }}>
        No ticket types are set up yet for this event. Check back soon.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="bk-form-fields" style={{ display: 'grid', gap: 18 }}>
      {loopPass && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(212,163,51,0.08)',
          border: '1px solid rgba(212,163,51,0.35)',
          borderRadius: 12,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: '#e8e8ec',
        }}>
          <div style={{ fontWeight: 800, color: ACCENT, marginBottom: 6 }}>Have a Loop Pass?</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            <li>Book with the <strong>same phone number</strong> you signed up for the pass with.</li>
            <li>Your seat comes off when you continue. If it was the only seat, you skip payment entirely.</li>
            <li>It covers loops inside the month you've paid for. For a date after your renewal, book once it renews.</li>
            <li>The pass is for <strong>you only</strong>, one seat per loop. Crew checks ID at the door. Friends you add pay the regular fare.</li>
          </ul>
        </div>
      )}
      <Section title="Your info">
        <Row>
          <Field label="First name" value={buyer.first_name} onChange={v => setBuyer(b => ({ ...b, first_name: v }))} />
          <Field label="Last name" value={buyer.last_name} onChange={v => setBuyer(b => ({ ...b, last_name: v }))} />
        </Row>
        <Row>
          <Field label="Phone" value={buyer.phone} type="tel" onChange={v => setBuyer(b => ({ ...b, phone: v }))} />
          <Field label="Email" value={buyer.email} type="email" onChange={v => setBuyer(b => ({ ...b, email: v }))} />
        </Row>
        <p style={{ fontSize: 13.5, color: '#d8d8de', lineHeight: 1.5, margin: '2px 0 0' }}>
          We text your booking confirmation and boarding pass to this phone. Reply STOP to any text to opt out.
        </p>
        <div style={{ padding: '8px 4px 0' }}>
          <ConsentCheckbox
            id="bk-sms-consent"
            checked={buyer.sms_consent}
            onChange={v => setBuyer(b => ({ ...b, sms_consent: v }))}
            fontSize={12.5}
          >
            <SmsConsentLabel brand={brandName} />
          </ConsentCheckbox>
        </div>
      </Section>

      {doorPickup && joinParty && (
        <Section title="Joining a group">
          <p style={{ fontSize: 15, color: '#f5f5f7', lineHeight: 1.55, margin: 0 }}>
            You&rsquo;re riding with <strong>{joinParty.organizer || 'your group'}</strong>
            {doorSlot ? <> at <strong style={{ color: ACCENT }}>{doorSlot.name.replace(/\s*·\s*Zone\s*\d/i, '')}</strong></> : null}.
          </p>
          <p style={{ fontSize: 13.5, color: '#d2d2d8', lineHeight: 1.55, margin: 0 }}>
            Pickup at {joinParty.street}, {joinParty.city}. Pay for your own seat below. Adding someone else? Add them as a rider.
          </p>
          {doorZone === BASE_ZONE && <BaseIdNotice checked={baseIdAck} onChange={setBaseIdAck} />}
        </Section>
      )}

      {doorPickup && !joinParty && (
        <Section title="Pickup">
          <span style={{ fontSize: 15, color: '#f5f5f7', fontWeight: 700 }}>Where should we pick you up?</span>
          <Field label="Street address" value={pickupAddress.street} onChange={v => setPickupAddress(a => ({ ...a, street: v }))} />
          <Row>
            <Field label="City" value={pickupAddress.city} onChange={v => setPickupAddress(a => ({ ...a, city: v }))} />
            <Field label="ZIP" value={pickupAddress.zip} onChange={v => { setPickupAddress(a => ({ ...a, zip: v })); setOnBase(null) }} />
          </Row>
          {zipValid && zipZones.length === 0 && (
            <div style={{ fontSize: 15, color: '#f87171', lineHeight: 1.5, padding: '12px 14px', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 12 }}>
              Sorry, that address is outside our pickup area. We pick up in Jacksonville, on base, and out to Hwy 172 in Hubert.
            </div>
          )}
          {zipZones.length > 1 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 15, color: '#f5f5f7', fontWeight: 700 }}>Is this address on base?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['Yes', true], ['No', false]].map(([label, v]) => (
                  <button key={label} type="button" onClick={() => setOnBase(v)}
                    style={{ ...btnGhost, flex: 1, ...(onBase === v ? { borderColor: '#d4a333', color: '#f0c24a', background: 'rgba(212,163,51,0.12)' } : {}) }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {riderZone != null && (
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 15, color: '#f5f5f7', fontWeight: 700 }}>Pick your pickup time</span>
              <span style={{ fontSize: 14, color: '#d2d2d8', lineHeight: 1.5, marginTop: -3 }}>
                These are the times we come to your area. We get to you sometime within that hour, and your driver texts you when they are on the way.
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {riderSlots.map(t => {
                  const full = t.remaining === 0
                  const on = slotReady && doorSlot?.id === t.id
                  return (
                    <button key={t.id} type="button" disabled={full}
                      onClick={() => { setDoorSlot(t.id); setSlotPicked(true) }}
                      style={{ ...btnGhost, display: 'grid', gap: 2, opacity: full ? 0.45 : 1, ...(on ? { borderColor: '#d4a333', color: '#f0c24a', background: 'rgba(212,163,51,0.12)' } : {}) }}>
                      <strong>{t.name.replace(/\s*·\s*Zone\s*\d/i, '')}</strong>
                      <span style={{ fontSize: 12 }}>{full ? 'Full' : Number.isFinite(t.remaining) && t.remaining <= 5 ? `${t.remaining} seats left` : 'Open'}</span>
                    </button>
                  )
                })}
              </div>
              {riderSlots.length > 0 && riderSlots.every(t => t.remaining === 0) && (
                <div style={{ fontSize: 14, color: '#f87171', lineHeight: 1.5 }}>Every time for your area is full.</div>
              )}
            </div>
          )}
          {riderZone === BASE_ZONE && <BaseIdNotice checked={baseIdAck} onChange={setBaseIdAck} />}
          <Field label="Anything the driver should know? (gate code, which building)" value={pickupAddress.notes} onChange={v => setPickupAddress(a => ({ ...a, notes: v }))} />
          <p style={{ fontSize: 15, color: '#f5f5f7', lineHeight: 1.55, margin: 0 }}>
            <strong style={{ color: ACCENT }}>You book at least {DOOR_PICKUP_MIN_RIDERS} seats (${DOOR_PICKUP_MIN_RIDERS * 10}).</strong> Bigger group? Anyone past {DOOR_PICKUP_MIN_RIDERS}
            can pay their own $10. We text them their link and hold their seat.
          </p>
          <ul style={{ fontSize: 15, color: '#f5f5f7', lineHeight: 1.5, margin: 0, padding: '14px 16px 14px 34px', background: 'rgba(212,163,51,0.10)', border: '1px solid rgba(212,163,51,0.35)', borderRadius: 12, display: 'grid', gap: 6 }}>
            <li><strong>Pickup within the hour.</strong> Other groups near you ride the same run, so we get to you sometime in the hour you choose, not exactly on the hour. Your driver texts you when they are on the way.</li>
            <li><strong>Pickup only.</strong> We drop your group downtown at the train depot, a short walk to Oktoberfest. The ride home is not included.</li>
            <li><strong>Every rider needs a $10 seat, kids included.</strong> List them with everyone else.</li>
            <li>Your whole group is picked up at one address. Groups of {DOOR_PICKUP_MIN_RIDERS} to {DOOR_PICKUP_MAX_RIDERS}, out to Hwy 172.</li>
            <li>Your $10 also gets you a seat on the Brew Loop that night (21+). Show your ticket when you board.</li>
          </ul>
        </Section>
      )}

      {organizer ? (
        <Section title="Your group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 15, color: '#f5f5f7', fontWeight: 700 }}>How many in your group, counting you?</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" aria-label="One fewer" onClick={() => setGroupSize(riders.length - 1)}
                disabled={riders.length <= DOOR_PICKUP_MIN_RIDERS} style={{ ...btnGhost, width: 44, fontSize: 20, padding: '6px 0' }}>&minus;</button>
              <strong style={{ fontSize: 22, color: ACCENT, minWidth: 28, textAlign: 'center' }}>{riders.length}</strong>
              <button type="button" aria-label="One more" onClick={() => setGroupSize(riders.length + 1)}
                disabled={riders.length >= DOOR_PICKUP_MAX_RIDERS} style={{ ...btnGhost, width: 44, fontSize: 20, padding: '6px 0' }}>+</button>
            </span>
          </div>
          <span style={{ fontSize: 14, color: '#d2d2d8', lineHeight: 1.5 }}>
            {DOOR_PICKUP_MIN_RIDERS} to {DOOR_PICKUP_MAX_RIDERS} people, kids count. Just their names. A phone is optional, skip it for kids.
          </span>
          <div style={{ fontSize: 14, color: '#d2d2d8' }}>
            <strong style={{ color: '#f5f5f7' }}>1. You</strong> (from the info above)
          </div>
          {riders.slice(1).map((r, k) => {
            const idx = k + 1
            return (
              <div key={idx} style={{ display: 'grid', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <strong style={{ fontSize: 14, color: '#f5f5f7' }}>{idx + 1}.</strong>
                <Row>
                  <Field label="First name" value={r.first_name} onChange={v => updateRider(idx, { first_name: v })} />
                  <Field label="Last name" value={r.last_name} onChange={v => updateRider(idx, { last_name: v })} />
                </Row>
                <Field label={r.pay_self ? 'Phone (we text them their link)' : 'Phone (optional)'} value={r.phone} type="tel" onChange={v => updateRider(idx, { phone: v })} />
                {idx >= DOOR_PICKUP_MIN_RIDERS && (
                  <CheckRow
                    checked={!!r.pay_self}
                    onChange={v => updateRider(idx, v
                      ? { pay_self: true, signed_by_buyer: false }
                      : { pay_self: false, signed_by_buyer: true })}
                    label="They pay their own $10 (we text them a link)"
                  />
                )}
              </div>
            )
          })}
        </Section>
      ) : (
      <Section title={`Riders (${riders.length})`}>
          <div style={{ display: 'grid', gap: 12 }}>
            {riders.map((r, idx) => {
              const tt = ticketTypes.find(t => t.id === r.ticket_type_id)
              return (
                /* No box. A rider is a passage of the section, marked by a
                   gold rail and a rule above it - not a card inside a card. */
                <div key={idx} style={{
                  display: 'grid',
                  gap: 12,
                  paddingLeft: 16,
                  paddingTop: idx === 0 ? 0 : 20,
                  borderLeft: `2px solid ${idx === 0 ? 'rgba(212,163,51,0.55)' : 'rgba(255,255,255,0.10)'}`,
                  borderTop: idx === 0 ? 0 : '1px solid rgba(255,255,255,0.07)',
                  marginLeft: 2,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: ACCENT, fontSize: 12.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>Rider {idx + 1}</strong>
                    {idx > 0 && !(organizer && riders.length <= DOOR_PICKUP_MIN_RIDERS) && (
                      <button type="button" onClick={() => removeRider(idx)} style={btnGhost}>Remove</button>
                    )}
                  </div>
  
                  {!doorPickup && (() => {
                    const sel = ticketTypes.find(x => x.id === r.ticket_type_id)
                    // A walk-on ticket is not tied to a stop, so for those this
                    // select really is just the ticket and the bar is asked
                    // separately below. For every normal ticket type it IS the
                    // pickup bar, and has to say so.
                    const walkOn = needsPickup(sel)
                    const label = fareLabel || (walkOn ? 'Which ticket?' : 'Where should we pick you up?')
                    const hint = fareLabel
                      ? fareHint
                      : (walkOn ? null : 'Pick the bar you’ll already be at. You can ride between every bar on the route from there, and the last loop brings you back to this one.')
                    // One fare is not a choice. Rendering it as a dropdown of one
                    // asks the rider to make a decision that does not exist.
                    const onlyFare = ticketTypes.length === 1 ? ticketTypes[0] : null
                    return (
                      <label style={{ display: 'grid', gap: 7 }}>
                        <span style={{ fontSize: 14, color: '#f5f5f7', fontWeight: 700 }}>
                          {label}
                        </span>
                        {hint && (
                          <span style={{ fontSize: 14, color: '#d2d2d8', lineHeight: 1.5, marginTop: -3 }}>
                            {hint}
                          </span>
                        )}
                        {onlyFare ? (
                          <span style={{
                            ...input, display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', gap: 10,
                          }}>
                            <span style={{ fontWeight: 700 }}>{ticketLabel(onlyFare)}</span>
                          </span>
                        ) : (
                          <select
                            value={r.ticket_type_id}
                            onChange={e => updateRider(idx, { ticket_type_id: e.target.value })}
                            style={input}
                          >
                            {ticketTypes.map(t => (
                              <option key={t.id} value={t.id} disabled={t.remaining === 0}>
                                {ticketLabel(t)}
                              </option>
                            ))}
                          </select>
                        )}
                        {sel && (
                          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: '#d2d2d8', gap: 8 }}>
                            <span>
                              {!walkOn && sel.pickup_time ? (
                                <>Be at <strong style={{ color: '#f5f5f7', fontWeight: 700 }}>{sel.name}</strong>{' '}
                                for <strong style={{ color: ACCENT, fontWeight: 700 }}>{formatPickupTime(sel.pickup_time)}</strong>.</>
                              ) : null}
                            </span>
                            <RemainingBadge remaining={sel.remaining} />
                          </span>
                        )}
                      </label>
                    )
                  })()}
  
                  {needsPickup(ticketTypes.find(x => x.id === r.ticket_type_id)) && (
                    <label style={{ display: 'grid', gap: 7 }}>
                      <span style={{ fontSize: 14, color: '#f5f5f7', fontWeight: 700 }}>
                        Where should we pick you up? <span style={{ color: ACCENT }}>*</span>
                      </span>
                      <span style={{ fontSize: 14, color: '#d2d2d8', lineHeight: 1.5, marginTop: -3 }}>
                        Pick the bar you&rsquo;ll already be at. You can ride between every bar on the
                        route from there, and the last loop brings you back to this one.
                      </span>
                      <select
                        value={r.pickup_stop_index}
                        onChange={e => updateRider(idx, { pickup_stop_index: e.target.value })}
                        style={{ ...input, borderColor: r.pickup_stop_index === '' ? '#f87171' : BORDER }}
                      >
                        <option value="" disabled>Which bar should we pick you up at?</option>
                        {stops.map(s => (
                          <option key={s.index} value={s.index}>
                            {s.name}{s.start_time ? ` — ${formatPickupTime(s.start_time)}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
  
                  {idx === 0 ? (
                    <CheckRow
                      checked={r.same_as_buyer}
                      onChange={v => updateRider(idx, { same_as_buyer: v, claim_link: false })}
                      label="This rider is me"
                    />
                  ) : null}
  
                  {/* The first 4 seats are always paid at checkout ($40 minimum).
                      Only a 5th rider and beyond can pay their own through a link. */}
                  {organizer && idx >= DOOR_PICKUP_MIN_RIDERS && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <RadioRow
                        name={`pay-${idx}`}
                        checked={!!r.pay_self}
                        onChange={() => updateRider(idx, { pay_self: true, claim_link: false, signed_self: false, signed_by_buyer: false })}
                        label="Send them a link to pay their own $10"
                      />
                      <RadioRow
                        name={`pay-${idx}`}
                        checked={!r.pay_self}
                        onChange={() => updateRider(idx, { pay_self: false, claim_link: true })}
                        label="I'll pay for them"
                      />
                    </div>
                  )}
  
                  {r.pay_self ? (
                    <>
                      <Row>
                        <Field label="First name" value={r.first_name} onChange={v => updateRider(idx, { first_name: v })} />
                        <Field label="Last name" value={r.last_name} onChange={v => updateRider(idx, { last_name: v })} />
                      </Row>
                      <Field label="Phone" value={r.phone} type="tel" onChange={v => updateRider(idx, { phone: v })} />
                      <span style={{ fontSize: 14, color: '#d2d2d8', lineHeight: 1.5 }}>
                        After you pay, we text them their personal link. They pay and sign their own waiver.
                      </span>
                    </>
                  ) : (<>
                  {idx > 0 && (
                    <CheckRow
                      checked={!!r.claim_link}
                      onChange={v => updateRider(idx, {
                        claim_link: v,
                        ...(v
                          ? { same_as_buyer: false, signed_self: false, signed_by_buyer: false, typed_name: '' }
                          : { signed_by_buyer: true }),
                      })}
                      label="I'll send this person a link to sign their own waiver"
                      accentText={!!r.claim_link}
                    />
                  )}
  
                  {r.claim_link ? (
                    <div style={{
                      padding: 10,
                      background: 'rgba(212,163,51,0.06)',
                      border: `1px dashed ${ACCENT}`,
                      borderRadius: 8,
                      fontSize: 13.5,
                      color: '#bbb',
                    }}>
                      Friend’s ticket — after payment we’ll give you a link to text them. They fill their info + sign on their own.
                    </div>
                  ) : (
                    <>
                      {!r.same_as_buyer && (
                        <>
                          <Row>
                            <Field label="First name" value={r.first_name} onChange={v => updateRider(idx, { first_name: v })} />
                            <Field label="Last name" value={r.last_name} onChange={v => updateRider(idx, { last_name: v })} />
                          </Row>
                          <Row>
                            <Field label="Phone" value={r.phone} type="tel" onChange={v => updateRider(idx, { phone: v })} />
                            <Field label="Email" value={r.email} type="email" onChange={v => updateRider(idx, { email: v })} />
                          </Row>
                        </>
                      )}
  
                      <div style={{ display: 'grid', gap: 10, paddingTop: 14, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        <strong style={{ fontSize: 12.5, color: ACCENT, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          Waiver for this rider
                        </strong>
                        <RadioRow
                          name={`sig-${idx}`}
                          checked={r.signed_self}
                          onChange={() => updateRider(idx, { signed_self: true, signed_by_buyer: false })}
                          label="This rider signs themselves"
                        />
                        {idx > 0 && (
                          <RadioRow
                            name={`sig-${idx}`}
                            checked={r.signed_by_buyer}
                            onChange={() => updateRider(idx, { signed_self: false, signed_by_buyer: true })}
                            label="I'm signing on their behalf"
                          />
                        )}
  
                        {r.signed_self && (
                          <input
                            placeholder="Type rider's full legal name"
                            value={r.typed_name}
                            onChange={e => updateRider(idx, { typed_name: e.target.value })}
                            style={input}
                          />
                        )}
                      </div>
                    </>
                  )}
                  </>)}
  
                  <div style={{ fontSize: 13.5, color: '#d2d2d8', textAlign: 'right' }}>
                    {r.pay_self ? 'Pays their own $10' : tt ? `$${(tt.price_cents / 100).toFixed(2)}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
  
          {!(doorPickup && riders.length >= DOOR_PICKUP_MAX_RIDERS) && !joinParty?.seat && (
            <button type="button" onClick={addRider} style={{ ...btnGhost, marginTop: 4, width: '100%' }}>
              + Add another rider
            </button>
          )}
        </Section>
      )}

      {organizer && brewLoopSeats && (
        <Section title="Brew Loop that night">
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ fontSize: 15, color: '#f5f5f7', fontWeight: 700 }}>How many of your group are riding the Brew Loop that night?</span>
              <span style={{ fontSize: 14, color: '#d2d2d8', lineHeight: 1.5, marginTop: -3 }}>
                We save you seats. Anyone riding gets taken to {brewLoopSeats.stop} and boards the Brew Loop there. 21+ only.
                {brewLoopSeats.left < DOOR_PICKUP_MAX_RIDERS && <> <strong style={{ color: ACCENT }}>{brewLoopSeats.left} seat{brewLoopSeats.left === 1 ? '' : 's'} left.</strong></>}
              </span>
              <select value={brewLoopRiders ?? ''} onChange={e => setBrewLoopRiders(e.target.value === '' ? null : Number(e.target.value))} style={input}>
                <option value="">Choose</option>
                {Array.from({ length: Math.min(riders.length, brewLoopSeats.left) + 1 }, (_, n) => (
                  <option key={n} value={n}>{n === 0 ? 'None of us, just Oktoberfest' : `${n} of us`}</option>
                ))}
              </select>
              {brewLoopRiders > riders.length && (
                <span style={{ fontSize: 13, color: '#f87171' }}>That is more than your group. Pick {riders.length} or fewer.</span>
              )}
            </label>
        </Section>
      )}

      {addons.length > 0 && (
        <Section title="Add to your night">
          <div style={{ display: 'grid', gap: 8 }}>
            {addons.map(a => {
              const qty = addonQty[a.id] || 0
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, background: '#202027', border: `1px solid ${BORDER}`, borderRadius: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#eee', fontWeight: 600 }}>
                      {a.name}{' '}
                      <span style={{ color: ACCENT, fontWeight: 700 }}>+${(a.price_cents / 100).toFixed(2)}</span>
                    </div>
                    {a.description && (
                      <div style={{ fontSize: 13.5, color: '#d2d2d8', marginTop: 2 }}>{a.description}</div>
                    )}
                  </div>
                  <Stepper
                    qty={qty}
                    onDec={() => setAddon(a.id, qty - 1)}
                    onInc={() => setAddon(a.id, qty + 1)}
                  />
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title="Liability waiver">
        <button
          type="button"
          onClick={() => setWaiverOpen(o => !o)}
          style={{ ...btnGhost, width: '100%', textAlign: 'left' }}
        >
          {waiverOpen ? 'Hide waiver' : 'Read waiver'}
        </button>

        {waiverOpen && waiver && (
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: 13,
            color: '#f2f2f5',
            background: '#202027',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 12,
            margin: 0,
            maxHeight: 280,
            overflowY: 'auto',
          }}>
            {waiver.body_md}
          </pre>
        )}

        {buyerOwesSig && (
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 13, color: '#bbb' }}>
              {organizer ? 'Type your full legal name to sign the waiver for everyone in your group, including any kids:' : 'Type your full legal name to sign on behalf of any riders above:'}
            </label>
            <input
              value={buyerTypedName}
              onChange={e => setBuyerTypedName(e.target.value)}
              placeholder="Your full legal name"
              style={{ ...input, marginTop: 6 }}
            />
            {buyerTypedName && (
              <div style={{ fontSize: 12.5, color: '#d2d2d8', marginTop: 4 }}>
                Signed by {buyerTypedName} · {new Date().toLocaleDateString('en-US')}
              </div>
            )}
          </div>
        )}
      </Section>

      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        {!bartenderOpen ? (
          <button
            type="button"
            onClick={() => setBartenderOpen(true)}
            style={{
              background: 'transparent',
              border: 0,
              color: '#d2d2d8',
              fontSize: 13.5,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 4,
            }}
          >
            Have a seller code?
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 6, maxWidth: 280, margin: '0 auto' }}>
            <input
              value={bartenderCode}
              onChange={e => setBartenderCode(e.target.value)}
              placeholder="Seller code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              style={{ ...input, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 13, padding: '8px 10px' }}
            />
            <div style={{ fontSize: 12.5, color: '#bcbcc3', textAlign: 'center' }}>
              Gives the person who sent you credit for the sale.
            </div>
          </div>
        )}
      </div>

      {soldOutTypes.length > 0 && (
        <WaitlistForm eventId={eventId} soldOutTypes={soldOutTypes} />
      )}

      <div style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE }}>
        <ConsentCheckbox
          id="bk-terms"
          checked={termsAccepted}
          onChange={setTermsAccepted}
          required
          fontSize={13}
        >
          {minAge
            ? <>Every rider on this order is {minAge} or older and will bring a valid photo ID. I am 18 or older and agree to the </>
            : doorPickup
              ? <>I agree to the </>
              : <>I am 18 or older and agree to the </>}
          <PolicyLink href="/terms">Terms of Service</PolicyLink>,{' '}
          <PolicyLink href="/refunds">Refund Policy</PolicyLink> and{' '}
          <PolicyLink href="/privacy">Privacy Policy</PolicyLink>.
        </ConsentCheckbox>
      </div>

      {(error || oversellError) && (
        <div style={{ padding: 10, background: '#3a1a1a', border: '1px solid #f87171', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
          {error || oversellError}
        </div>
      )}

      {/* The destination. It was the same grey box at the same weight as
          every other grey box, so the end of the page looked like the middle
          of it. Gold-lit, bigger number, clearly where this is going. */}
      <div style={{
        padding: 'clamp(20px, 3vw, 26px)',
        background: 'linear-gradient(180deg, rgba(212,163,51,0.10), rgba(212,163,51,0.02) 60%), #1b1b21',
        border: '1px solid rgba(212,163,51,0.28)',
        borderRadius: 18,
        display: 'grid',
        gap: 14,
        boxShadow: '0 22px 50px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: '#d8d8de', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: 'clamp(30px, 4vw, 38px)', fontWeight: 800, color: ACCENT, letterSpacing: '-0.03em', lineHeight: 1 }}>
            ${(totalCents / 100).toFixed(2)}
          </span>
        </div>
        {/* The disabled state used to be #3a2f15 on #7a6a3a - a muddy brown
            bar with unreadable text that looked like a broken button rather
            than a form waiting to be filled in. It is a neutral, legible
            "not yet" now, and the line underneath says what it is waiting for
            instead of leaving the rider to guess. The `disabled` condition
            itself is unchanged: this is a live checkout and the styling pass
            does not touch what gates the payment. */}
        <button
          type="submit"
          disabled={!formValid || submitting}
          style={{
            background: formValid && !submitting
              ? 'linear-gradient(180deg, #f0c24a, #d4a333)'
              : 'rgba(255,255,255,0.05)',
            color: formValid && !submitting ? '#0a0a0b' : '#bcbcc3',
            border: formValid && !submitting ? '1px solid transparent' : '1px solid rgba(255,255,255,0.12)',
            padding: '15px 20px',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '0.01em',
            cursor: formValid && !submitting ? 'pointer' : 'not-allowed',
            width: '100%',
            boxShadow: formValid && !submitting ? '0 10px 28px rgba(212,163,51,0.28)' : 'none',
            transition: 'background 160ms ease, box-shadow 160ms ease, color 160ms ease',
          }}
        >
          {submitting ? 'Loading…' : `Pay $${(totalCents / 100).toFixed(2)}`}
        </button>
        {!formValid && !submitting && (
          <div style={{ fontSize: 13.5, color: '#bcbcc3', textAlign: 'center', lineHeight: 1.45 }}>
            Add your details, pick a pickup bar, sign the waiver, and agree to the Terms to continue.
          </div>
        )}
        {loopPass && (
          <div style={{ fontSize: 13.5, color: '#c9c9cf', textAlign: 'center', lineHeight: 1.5 }}>
            Loop Pass members: this total is before your pass. Your seat is removed on the next step.
          </div>
        )}
        <div style={{ fontSize: 13, color: '#bcbcc3', textAlign: 'center', lineHeight: 1.5 }}>
          No booking or service fees are added at checkout. Secure checkout powered by Stripe.
        </div>
      </div>

      <style>{`
        /* Only what an inline style object cannot express. The base look of
           these controls lives in the input style object above, because inline
           wins over a stylesheet and splitting it would make the two fight. */
        .bk-form-fields input::placeholder { color: #a8a8b0; }
        .bk-form-fields input:focus-visible,
        .bk-form-fields select:focus-visible,
        .bk-form-fields textarea:focus-visible,
        .bk-form-fields button:focus-visible {
          outline: none;
          border-color: rgba(212,163,51,0.7);
          box-shadow: 0 0 0 3px rgba(212,163,51,0.18);
        }
        .bk-form-fields select {
          background: #3a3a43;
          border: 1px solid rgba(255,255,255,0.14);
          color: #f5f5f7;
          padding: 12px 13px;
          border-radius: 10px;
          font-size: 16px;
          width: 100%;
          box-sizing: border-box;
        }
        /* These buttons set their background inline, and inline beats any
           selector - so this needs !important or it silently does nothing.
           Scoped to hover only, and never to the submit button, which owns
           its own gold treatment. */
        .bk-form-fields button:not(:disabled):not([type="submit"]):hover {
          border-color: rgba(212,163,51,0.45) !important;
          background: rgba(212,163,51,0.08) !important;
        }
      `}</style>
    </form>
  )
}

function ticketLabel(t) {
  const time = formatPickupTime(t.pickup_time)
  const price = `$${(t.price_cents / 100).toFixed(2)}`
  const head = time ? `${t.name} — ${time} — ${price}` : `${t.name} — ${price}`
  if (t.remaining === 0) return `${head} — Sold out`
  if (Number.isFinite(t.remaining) && t.remaining <= 5) return `${head} — ${t.remaining} left`
  return head
}

function RemainingBadge({ remaining }) {
  if (remaining == null) return null
  if (remaining === 0) {
    return (
      <span style={{
        fontSize: 12.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#f87171',
        background: 'rgba(248,113,113,0.12)',
        border: '1px solid rgba(248,113,113,0.5)',
        padding: '2px 6px',
        borderRadius: 4,
      }}>Sold out</span>
    )
  }
  if (remaining > 5) return null
  const tight = remaining <= 3
  return (
    <span style={{
      fontSize: 12.5,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: tight ? '#f87171' : ACCENT,
      background: tight ? 'rgba(248,113,113,0.08)' : 'rgba(212,163,51,0.08)',
      border: `1px solid ${tight ? 'rgba(248,113,113,0.4)' : 'rgba(212,163,51,0.35)'}`,
      padding: '2px 6px',
      borderRadius: 4,
    }}>{remaining} left</span>
  )
}

function formatPickupTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function newGuest(ticketTypeId, paySelf = false) {
  return {
    pay_self: paySelf,
    ticket_type_id: ticketTypeId,
    first_name: '', last_name: '', email: '', phone: '',
    same_as_buyer: false,
    signed_self: false,
    signed_by_buyer: false,
    claim_link: true,
    typed_name: '',
    pickup_stop_index: '',
  }
}

// A door pickup group member: the organizer signs for them, no claim link.
function newGroupRider(ticketTypeId) {
  return { ...newGuest(ticketTypeId), claim_link: false, signed_by_buyer: true }
}

function mintToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function Section({ title, children }) {
  return (
    <section style={{
      // The ONE card level on this form. Lit along the top edge like every
      // other surface on the site, and nothing inside it is allowed to be a
      // box as well - that stacking is what made this page look like a form.
      background: `linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 42%), ${SURFACE}`,
      border: `1px solid ${BORDER}`,
      borderRadius: 18,
      padding: 'clamp(20px, 3vw, 28px)',
      display: 'grid',
      gap: 16,
      boxShadow: '0 20px 44px rgba(0,0,0,0.38)',
    }}>
      {/* A real heading, not a 11px gold caps label. The whole page was set
          at one size, so nothing led the eye anywhere. */}
      <h2 style={{
        fontSize: 'clamp(17px, 2.2vw, 20px)', color: '#f5f5f7', margin: 0,
        letterSpacing: '-0.015em', fontWeight: 800, display: 'flex',
        alignItems: 'center', gap: 10,
      }}>
        <span aria-hidden style={{
          width: 4, height: 17, borderRadius: 2, flex: '0 0 auto',
          background: `linear-gradient(180deg, ${ACCENT}, rgba(212,163,51,0.25))`,
        }} />
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label style={{ display: 'grid', gap: 7, fontSize: 14, color: '#d8d8de', fontWeight: 600 }}>
      {label}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={input} />
    </label>
  )
}

// Zone 3 (on base): the gate needs an ID for every rider, so the booker
// confirms it before paying. The driver checks it again at the bus.
function BaseIdNotice({ checked, onChange }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(212,163,51,0.5)', background: 'rgba(212,163,51,0.08)', display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 14, color: '#f5f5f7', lineHeight: 1.5 }}>
        <strong style={{ color: ACCENT }}>On base pickup: military or dependent ID required.</strong> Every adult needs a valid military ID or dependent ID to get on base. Kids ride with their parent or guardian. No ID, no ride.
      </div>
      <CheckRow checked={checked} onChange={onChange} label={BASE_ID_TEXT} />
    </div>
  )
}

function CheckRow({ checked, onChange, label, accentText = false }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 4px',
      fontSize: 14,
      color: accentText ? ACCENT : '#ddd',
      cursor: 'pointer',
      lineHeight: 1.35,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{
          accentColor: ACCENT,
          width: 18,
          height: 18,
          flexShrink: 0,
          cursor: 'pointer',
          margin: 0,
        }}
      />
      <span>{label}</span>
    </label>
  )
}

function WaitlistForm({ eventId, soldOutTypes }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    first_name: '', last_name: '', phone: '',
    party_size: 1, ticket_type_id: soldOutTypes[0]?.id || '',
  })
  const [state, setState] = useState('idle') // idle | submitting | done
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    setErr(null)
    const tt = soldOutTypes.find(t => t.id === f.ticket_type_id)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          ticket_type_id: f.ticket_type_id || null,
          stop_index: tt?.stop_index ?? null,
          first_name: f.first_name,
          last_name: f.last_name,
          phone: f.phone,
          party_size: Number(f.party_size) || 1,
        }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(typeof j.error === 'string' ? j.error : 'Could not join. Try again.'); setState('idle'); return }
      setState('done')
    } catch {
      setErr('Could not reach the waitlist. Try again.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div style={{ padding: 14, background: 'rgba(63,178,127,0.08)', border: '1px solid rgba(63,178,127,0.4)', borderRadius: 10, color: '#9fe3bf', fontSize: 14 }}>
        You&rsquo;re on the waitlist. We&rsquo;ll text you if a seat opens up.
      </div>
    )
  }

  return (
    <Section title="Sold out where you wanted?">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{ ...btnGhost, width: '100%' }}>
          Join the waitlist
        </button>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ fontSize: 13.5, color: '#d2d2d8', margin: 0 }}>
            We&rsquo;ll reach out if a seat frees up. No charge until you book.
          </p>
          {soldOutTypes.length > 1 && (
            <select value={f.ticket_type_id} onChange={e => setF(s => ({ ...s, ticket_type_id: e.target.value }))} style={input}>
              {soldOutTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <Row>
            <Field label="First name" value={f.first_name} onChange={v => setF(s => ({ ...s, first_name: v }))} />
            <Field label="Last name" value={f.last_name} onChange={v => setF(s => ({ ...s, last_name: v }))} />
          </Row>
          <Row>
            <Field label="Phone" value={f.phone} type="tel" onChange={v => setF(s => ({ ...s, phone: v }))} />
            <label style={{ display: 'grid', gap: 4, fontSize: 13.5, color: '#d2d2d8' }}>
              Party size
              <input type="number" min={1} max={20} value={f.party_size} onChange={e => setF(s => ({ ...s, party_size: e.target.value }))} style={input} />
            </label>
          </Row>
          {err && <div style={{ color: '#f87171', fontSize: 13.5 }}>{err}</div>}
          <button
            type="button"
            onClick={submit}
            disabled={state === 'submitting' || !f.first_name.trim() || !f.phone.trim()}
            style={{ ...btnGhost, width: '100%', opacity: (!f.first_name.trim() || !f.phone.trim()) ? 0.5 : 1 }}
          >
            {state === 'submitting' ? 'Joining…' : 'Join the waitlist'}
          </button>
          <div style={{ fontSize: 13, color: '#d2d2d8', lineHeight: 1.5 }}>
            By joining, you ask us to text this number if a seat opens for this loop. Msg &amp; data rates may apply. Reply STOP to opt out.
            See our <PolicyLink href="/privacy">Privacy Policy</PolicyLink>.
          </div>
        </div>
      )}
    </Section>
  )
}

function Stepper({ qty, onDec, onInc }) {
  const btn = {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`,
    background: '#202027', color: ACCENT, fontSize: 18, lineHeight: 1,
    cursor: 'pointer', flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <button type="button" onClick={onDec} disabled={qty === 0} style={{ ...btn, opacity: qty === 0 ? 0.4 : 1, cursor: qty === 0 ? 'not-allowed' : 'pointer' }} aria-label="Remove one">−</button>
      <span style={{ minWidth: 16, textAlign: 'center', color: '#eee', fontSize: 15, fontWeight: 700 }}>{qty}</span>
      <button type="button" onClick={onInc} style={btn} aria-label="Add one">+</button>
    </div>
  )
}

function RadioRow({ name, checked, onChange, label }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 4px',
      fontSize: 14,
      color: '#f2f2f5',
      cursor: 'pointer',
      lineHeight: 1.35,
    }}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        style={{
          accentColor: ACCENT,
          width: 18,
          height: 18,
          flexShrink: 0,
          cursor: 'pointer',
          margin: 0,
        }}
      />
      <span>{label}</span>
    </label>
  )
}

// Inline, because inline beats the stylesheet - so the BASE look has to live
// here and the sheet below only handles what inline styles cannot express
// (:focus-visible, ::placeholder, the select arrow).
// 16px is not an aesthetic choice: iOS Safari zooms the whole viewport when a
// focused input is under 16px, which on a checkout form throws the rider's
// layout around mid-purchase.
const input = {
  // A lifted fill, not a black hole. Against the section surface these used to
  // read as punched-out voids in a row, which is most of why a plain four-field
  // block looked so grim.
  background: 'rgba(255,255,255,0.09)',
  border: '1px solid rgba(255,255,255,0.22)',
  color: '#f5f5f7',
  padding: '12px 13px',
  borderRadius: 10,
  fontSize: 16,
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color .18s ease, box-shadow .18s ease',
}

const btnGhost = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#f0c24a',
  padding: '12px 14px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'border-color .2s ease, background .2s ease',
}
