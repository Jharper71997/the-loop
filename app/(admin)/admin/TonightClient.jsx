'use client'

import { useMemo } from 'react'
import SmsBroadcast from '../_components/SmsBroadcast'
import PickedUpToggle from '../_components/PickedUpToggle'
import SmsButton from '../_components/SmsButton'
import TtBackfillButton from '../_components/TtBackfillButton'
import { formatStopTime } from '@/lib/schedule'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

export default function TonightClient({ state, today, group, currentIdx, ordersToday, ticketsByContact = {}, totalTickets = 0, upcomingGroups = [] }) {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', minHeight: '100vh', color: '#fff' }}>
      <Header today={today} group={group} state={state} />

      {state === 'none' && <NoLoopState today={today} />}
      {state === 'upcoming' && <UpcomingLoopState group={group} ticketsByContact={ticketsByContact} totalTickets={totalTickets} />}
      {state === 'pre_pickup' && <PrePickupState group={group} ticketsByContact={ticketsByContact} totalTickets={totalTickets} />}
      {state === 'in_progress' && <InProgressState group={group} currentIdx={currentIdx} ticketsByContact={ticketsByContact} totalTickets={totalTickets} />}

      <UpNextSection groups={upcomingGroups} />

      {ordersToday.length > 0 && (
        <section style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginTop: 14,
        }}>
          <h2 style={sectionHeader}>Orders today ({ordersToday.length})</h2>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {ordersToday.map(o => {
              const ttTagged = o.metadata?.source === 'ticket_tailor'
              return (
                <div key={o.id} style={{
                  padding: 8, background: '#0e0e12', borderRadius: 6, fontSize: 12,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                }}>
                  <span>
                    {o.buyer_name || '(no name)'} · {o.party_size} ticket{o.party_size === 1 ? '' : 's'}
                    {ttTagged && (
                      <span style={{
                        marginLeft: 8,
                        fontSize: 9,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: '#9c9ca3',
                        border: '1px solid #2a2a31',
                        padding: '1px 6px',
                        borderRadius: 3,
                      }}>TT</span>
                    )}
                  </span>
                  <span style={{ color: ACCENT, fontWeight: 600 }}>${(o.total_cents / 100).toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <TtBackfillButton />
    </main>
  )
}

function Header({ today, group, state }) {
  const isLive = state === 'pre_pickup' || state === 'in_progress'
  const eyebrow = isLive ? 'Live · Today' : 'Schedule'
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{
          color: isLive ? '#6fbf7f' : '#9c9ca3',
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {isLive && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#6fbf7f', boxShadow: '0 0 10px #6fbf7f',
              display: 'inline-block',
            }} />
          )}
          {eyebrow}
        </div>
        <h1 style={{ fontSize: 'clamp(22px, 6vw, 28px)', color: ACCENT, margin: '4px 0 0' }}>Schedule</h1>
        <span style={{ color: '#9c9ca3', fontSize: 13 }}>{formatToday(today)}</span>
      </div>
      <a href="/admin/groups/new" style={{
        background: ACCENT, color: '#0a0a0b',
        padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none',
        minHeight: 44, display: 'inline-flex', alignItems: 'center',
      }}>+ New Loop</a>
    </div>
  )
}

function NoLoopState() {
  return (
    <section style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, color: '#9c9ca3', marginBottom: 8 }}>No Loops scheduled</div>
      <p style={{ color: '#bbb', fontSize: 14, margin: '0 0 16px' }}>
        When you create a Loop on the Loops tab, this page will show its manifest, stops, and a one-tap broadcast.
      </p>
      <a href="/admin/groups/new" style={{
        display: 'inline-block', background: ACCENT, color: '#0a0a0b',
        padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none',
      }}>+ Create your first Loop</a>
    </section>
  )
}

function UpcomingLoopState({ group, ticketsByContact, totalTickets }) {
  const riders = flattenMembers(group, ticketsByContact)
  const signed = riders.filter(r => r.has_signed_waiver).length
  const seatLabel = formatSeatLabel(riders.length, totalTickets)
  return (
    <>
      <Hero>
        <div style={{ color: '#9c9ca3', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next Loop</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
          {formatDate(group.event_date)}{group.pickup_time ? ` · ${formatStopTime(group.pickup_time)}` : ''}
        </div>
        <div style={{ color: '#d4a333', fontSize: 14, marginTop: 2 }}>{group.name}</div>
        <div style={{ color: '#9c9ca3', fontSize: 13, marginTop: 8 }}>
          {seatLabel} booked · {signed}/{riders.length} waivers signed
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <a href={`/groups/${group.id}`} style={secondaryBtn}>Open Manage view →</a>
        </div>
      </Hero>

      <div style={{ marginTop: 14 }}>
        <SmsBroadcast recipients={riders} title="Text the riders on this Loop" />
      </div>
    </>
  )
}

function PrePickupState({ group, ticketsByContact, totalTickets }) {
  const riders = flattenMembers(group, ticketsByContact)
  const signed = riders.filter(r => r.has_signed_waiver).length
  const stops = Array.isArray(group?.schedule) ? group.schedule : []
  const countdown = minutesUntil(group.pickup_time)
  const seatLabel = formatSeatLabel(riders.length, totalTickets)

  return (
    <>
      <Hero>
        <div style={{ color: '#9c9ca3', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tonight</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
          {group.name} · pickup {group.pickup_time ? formatStopTime(group.pickup_time) : 'TBD'}
          {countdown != null && (
            <span style={{ color: '#9c9ca3', fontSize: 14, marginLeft: 8 }}>(in {formatCountdown(countdown)})</span>
          )}
        </div>
        <div style={{ color: '#9c9ca3', fontSize: 13, marginTop: 8 }}>
          {seatLabel} · {signed}/{riders.length} waivers signed
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <a href={`/groups/${group.id}`} style={secondaryBtn}>Manage Loop →</a>
          <a href="/track" style={secondaryBtn}>Open tracker →</a>
        </div>
      </Hero>

      <div style={{ marginTop: 14 }}>
        <SmsBroadcast recipients={riders} stops={stops} title="Text riders" />
      </div>

      <StopCards stops={stops} riders={riders} currentIdx={-1} />
    </>
  )
}

function InProgressState({ group, currentIdx, ticketsByContact, totalTickets }) {
  const riders = flattenMembers(group, ticketsByContact)
  const stops = Array.isArray(group?.schedule) ? group.schedule : []
  const currentStop = stops[currentIdx]
  const seatLabel = formatSeatLabel(riders.length, totalTickets)

  return (
    <>
      <Hero>
        <div style={{ color: '#9c9ca3', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Loop in progress
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{group.name}</div>
        {currentStop && (
          <div style={{ marginTop: 6 }}>
            <span style={{
              display: 'inline-block', background: ACCENT, color: '#0a0a0b',
              padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            }}>
              Current: {currentIdx + 1}. {currentStop.name}
            </span>
          </div>
        )}
        <div style={{ color: '#9c9ca3', fontSize: 13, marginTop: 8 }}>{seatLabel}</div>
      </Hero>

      <section style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
        padding: 14, marginTop: 14,
      }}>
        <h2 style={sectionHeader}>Live shuttle map</h2>
        <p style={{ color: '#9c9ca3', fontSize: 13, margin: '8px 0 12px' }}>
          The native map is shipping this week. Until then, open the rider tracker:
        </p>
        <a href="/track" style={secondaryBtn}>Open rider tracker →</a>
      </section>

      <div style={{ marginTop: 14 }}>
        <SmsBroadcast recipients={riders} stops={stops} title="Text riders" />
      </div>

      <StopCards stops={stops} riders={riders} currentIdx={currentIdx} showCheckoff />
    </>
  )
}

function StopCards({ stops, riders, currentIdx, showCheckoff = false }) {
  const byStop = useMemo(() => {
    const map = new Map()
    for (const r of riders) {
      const idx = r.current_stop_index ?? -1
      if (!map.has(idx)) map.set(idx, [])
      map.get(idx).push(r)
    }
    return map
  }, [riders])

  const unassigned = useMemo(
    () => (riders || []).filter(r =>
      r.current_stop_index == null || r.current_stop_index < 0 || r.current_stop_index >= stops.length
    ),
    [riders, stops.length],
  )

  if (!stops.length) {
    return (
      <section style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginTop: 14,
      }}>
        <p style={{ color: '#9c9ca3', margin: 0, fontSize: 13 }}>
          No schedule on this Loop yet. Open it on Loops to add stops.
        </p>
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      {unassigned.length > 0 && (
        <section style={{
          background: SURFACE, border: `1px solid #f87171`, borderRadius: 12, padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: '#f87171', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Unassigned</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171' }}>No stop yet — assign on Loops tab</div>
            </div>
            <span style={{ fontSize: 12, color: '#f87171' }}>
              {unassigned.length} rider{unassigned.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {unassigned.map(r => (
              <div key={r.member_id} style={{
                padding: 8, background: '#0e0e12', borderRadius: 8, border: `1px solid ${BORDER}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{r.first_name} {r.last_name}</strong>
                  {r.tickets > 1 && <TicketBadge tickets={r.tickets} />}
                  {r.phone && <span style={{ color: '#9c9ca3', fontSize: 11, marginLeft: 6 }}>{r.phone}</span>}
                </div>
                <SmsButton contact={r} />
              </div>
            ))}
          </div>
        </section>
      )}

      {stops.map((stop, i) => {
        const atStop = (riders || []).filter(r => (r.current_stop_index ?? -1) === i)
        const isCurrent = i === currentIdx
        const past = currentIdx > i
        return (
          <section key={i} style={{
            background: SURFACE,
            border: `1px solid ${isCurrent ? ACCENT : BORDER}`,
            borderRadius: 12, padding: 14,
            opacity: past ? 0.6 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9c9ca3' }}>Stop {i + 1} · {formatStopTime(stop.start_time)}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isCurrent ? ACCENT : '#fff' }}>{stop.name}</div>
              </div>
              <span style={{ fontSize: 12, color: '#9c9ca3' }}>
                {atStop.length} rider{atStop.length === 1 ? '' : 's'}
              </span>
            </div>

            {atStop.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {atStop.map(r => (
                  <div key={r.member_id} style={{
                    padding: 8, background: '#0e0e12', borderRadius: 8, border: `1px solid ${BORDER}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{r.first_name} {r.last_name}</strong>
                      {r.tickets > 1 && <TicketBadge tickets={r.tickets} />}
                      {r.phone && <span style={{ color: '#9c9ca3', fontSize: 11, marginLeft: 6 }}>{r.phone}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {showCheckoff && (
                        <PickedUpToggle
                          memberId={r.member_id}
                          stopIndex={i}
                          initialPickedUp={false}
                        />
                      )}
                      <SmsButton contact={r} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function UpNextSection({ groups }) {
  if (!groups || !groups.length) return null
  return (
    <section style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginTop: 14,
    }}>
      <h2 style={sectionHeader}>Up next</h2>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {groups.map(g => {
          const seats = (g.group_members || []).length
          return (
            <a
              key={g.id}
              href={`/admin/groups/${g.id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: '#0e0e12',
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                textDecoration: 'none',
                color: '#fff',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: ACCENT, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
                  {formatDate(g.event_date)}{g.pickup_time ? ` · ${formatStopTime(g.pickup_time)}` : ''}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{g.name || 'Brew Loop'}</div>
              </div>
              <span style={{ fontSize: 12, color: '#9c9ca3' }}>
                {seats} rider{seats === 1 ? '' : 's'}
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}

function TicketBadge({ tickets }) {
  return (
    <span style={{
      display: 'inline-block',
      marginLeft: 8,
      padding: '1px 7px',
      borderRadius: 999,
      background: 'rgba(212,163,51,0.15)',
      color: ACCENT,
      border: '1px solid rgba(212,163,51,0.4)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      verticalAlign: 'middle',
    }}>
      {tickets} tix
    </span>
  )
}

function Hero({ children }) {
  return (
    <section style={{
      background: SURFACE, border: `1px solid ${ACCENT}`, borderRadius: 14, padding: 18,
    }}>
      {children}
    </section>
  )
}

function flattenMembers(group, ticketsByContact = {}) {
  if (!group?.group_members) return []
  return group.group_members.map(m => ({
    member_id: m.id,
    current_stop_index: m.current_stop_index,
    id: m.contacts?.id,
    first_name: m.contacts?.first_name || '',
    last_name: m.contacts?.last_name || '',
    phone: m.contacts?.phone || null,
    has_signed_waiver: !!m.contacts?.has_signed_waiver,
    tickets: m.contacts?.id ? (ticketsByContact[m.contacts.id] || 1) : 1,
  }))
}

function formatSeatLabel(riderCount, totalTickets) {
  if (totalTickets > 0 && totalTickets !== riderCount) {
    return `${totalTickets} ticket${totalTickets === 1 ? '' : 's'} · ${riderCount} contact${riderCount === 1 ? '' : 's'}`
  }
  return `${riderCount} rider${riderCount === 1 ? '' : 's'}`
}

function formatToday(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function minutesUntil(hhmm) {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const now = new Date()
  const target = new Date(now)
  target.setHours(h, m, 0, 0)
  const diff = Math.round((target - now) / 60000)
  return diff
}

function formatCountdown(mins) {
  if (mins < 0) return 'past'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const sectionHeader = {
  fontSize: 12, color: ACCENT, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase',
}

const secondaryBtn = {
  display: 'inline-block', color: ACCENT, textDecoration: 'none',
  border: `1px solid ${ACCENT}`, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
}
