'use client'

import { useState } from 'react'

const RED = '#b42318'
const GREEN = '#0f7a4e'
const GOLD_INK = '#8a5f0a'

// A door pickup day (Oktoberfest) on the Loops page, in the same card as a
// Loop: tap to open, then every pickup hour with each group's address, the
// organizer's phone, and every rider marked paid or not.
export default function DoorPickupCard({ ev, isTonight }) {
  const [open, setOpen] = useState(isTonight)
  const [openSlot, setOpenSlot] = useState(null)

  return (
    <div className="card">
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }} className="row">
        <div>
          <p style={{ fontWeight: 600, fontSize: '15px', color: '#17130f' }}>
            {ev.name}
            {isTonight && <span className="chip chip-gold" style={{ marginLeft: '8px' }}>LIVE</span>}
          </p>
          <p className="muted" style={{ fontSize: '12px' }}>Door pickup · {formatDate(ev.event_date)}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {ev.unpaid > 0 && (
            <span className="chip" style={{ background: 'rgba(180,35,24,0.08)', borderColor: 'rgba(180,35,24,0.4)', color: RED, fontWeight: 700 }}>
              {ev.unpaid} not paid
            </span>
          )}
          <span className="chip">{ev.seats} rider{ev.seats === 1 ? '' : 's'}</span>
          <span className="muted" style={{ fontSize: '14px' }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>

      {open && (
        <>
          <div style={{
            margin: '12px 0 8px', padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
            background: '#fdfaf3', border: '1px solid #e8ddc8', color: '#3b322a',
          }}>
            <strong style={{ color: GOLD_INK }}>All ages.</strong> Kids ride with their group and are on the list like everyone else. No 21+ check for this ride.
            {' '}Riders were told we come sometime within their hour and that the driver texts first, so tap <strong>On my way</strong> as you head to each group.
            {' '}<strong style={{ color: RED }}>Not paid</strong> does not board until they pay at their link.
          </div>

          {ev.slots.map(slot => {
            const slotOpen = openSlot === slot.id || (openSlot === null && slot.seats > 0 && isTonight)
            return (
              <div key={slot.id} style={{ borderTop: '1px solid #efe6d4', padding: '8px 0' }}>
                <div
                  onClick={() => setOpenSlot(slotOpen ? '' : slot.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: slot.seats ? 'pointer' : 'default', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, color: slot.seats ? '#17130f' : '#9a8f82' }}>{slot.name}</span>
                  <span style={{ fontSize: 12, color: slot.seats ? GOLD_INK : '#9a8f82', fontWeight: slot.seats ? 700 : 500 }}>
                    {slot.seats} / {slot.capacity} · Zone {slot.zone} {slot.seats ? (slotOpen ? '▾' : '▸') : ''}
                  </span>
                </div>
                {slotOpen && slot.groups.map(g => <PickupGroup key={g.id} g={g} />)}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function PickupGroup({ g }) {
  const first = (g.organizer || '').split(' ')[0] || 'there'
  const onMyWay = `Hi ${first}, this is your Brew Loop driver. I'm on my way to pick up your group for Oktoberfest. Please be ready out front.`
  return (
    <div style={{
      margin: '8px 0 0', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, lineHeight: 1.5,
      background: '#fff', border: `1px solid ${g.unpaid ? 'rgba(180,35,24,0.45)' : '#e8ddc8'}`, color: '#17130f',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong>{g.organizer}</strong>
        <strong style={{ color: g.unpaid ? RED : GREEN, fontSize: 12.5 }}>
          {g.unpaid ? `${g.unpaid} NOT PAID` : 'All paid'} · {g.riders.length - g.unpaid} of {g.riders.length}
        </strong>
      </div>
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.address)}`} style={{ color: '#17130f' }}>
        {g.address || 'no address'}
      </a>
      {!g.verified && <div style={{ color: RED, fontSize: 12.5 }}>Address not verified on the map. Check it before the run.</div>}
      {g.onBase && <div style={{ color: GOLD_INK, fontWeight: 700, fontSize: 12.5 }}>On base: check every adult's military or dependent ID before they board. Kids ride with their parent or guardian.</div>}
      {g.notes && <div className="muted" style={{ fontSize: 12.5 }}>Note: {g.notes}</div>}
      {g.brewLoop > 0 && <div style={{ color: GOLD_INK, fontWeight: 700, fontSize: 12.5 }}>Brew Loop tonight: {g.brewLoop} riding. Take them to {g.brewLoopStop || 'Angry Ginger'} after Oktoberfest to board.</div>}
      {g.phone && (
        <div style={{ display: 'flex', gap: 6, margin: '8px 0 2px', flexWrap: 'wrap' }}>
          <a href={`sms:${g.phone}?&body=${encodeURIComponent(onMyWay)}`} style={pillGold}>On my way</a>
          <a href={`tel:${g.phone}`} style={pillPlain}>Call {g.phone}</a>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 5 }}>
        {g.riders.map((r, i) => (
          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>
              <strong style={{ color: r.paid ? GREEN : RED }}>{r.paid ? '✓ PAID' : '✗ NOT PAID'}</strong>{' '}
              {r.name} <span className="muted" style={{ fontSize: 12 }}>{r.paid ? r.by : r.phone}</span>
            </span>
            {!r.paid && (
              <span style={{ display: 'flex', gap: 6 }}>
                <a href={r.link} style={pillGold}>Pay now</a>
                <a href={`sms:${r.phone || ''}?&body=${encodeURIComponent(`Pay your $10 Oktoberfest seat before you board: ${r.link}`)}`} style={pillPlain}>Text link</a>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00-05:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const pillGold = {
  padding: '5px 12px', borderRadius: 999, background: '#d4a333', color: '#231903',
  fontWeight: 700, fontSize: 12.5, textDecoration: 'none', minHeight: 30, display: 'inline-flex', alignItems: 'center',
}
const pillPlain = {
  ...pillGold, background: '#fff', border: '1px solid #e8ddc8', color: '#3b322a',
}
