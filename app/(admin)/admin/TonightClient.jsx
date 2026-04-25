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
const TRACK_URL = 'https://zenbus.zenduit.com/map/jville_brew_loop/6998b2d1d9a9a1bab8a072dc'

export default function TonightClient({ state, today, group, currentIdx, ordersToday }) {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', minHeight: '100vh', color: '#fff' }}>
      <Header today={today} group={group} state={state} />

      {state === 'none' && <NoLoopState today={today} />}
      {state === 'upcoming' && <UpcomingLoopState group={group} />}
      {state === 'pre_pickup' && <PrePickupState group={group} />}
      {state === 'in_progress' && <InProgressState group={group} currentIdx={currentIdx} />}

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
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 'clamp(22px, 6vw, 28px)', color: ACCENT, margin: 0 }}>Tonight</h1>
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

function UpcomingLoopState({ group }) {
  const riders = flattenMembers(group)
  const signed = riders.filter(r => r.has_signed_waiver).length
  return (
    <>
      <Hero>
        <div style={{ color: '#9c9ca3', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next Loop</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
          {formatDate(group.event_date)}{group.pickup_time ? ` · ${formatStopTime(group.pickup_time)}` : ''}
        </div>
        <div style={{ color: '#d4a333', fontSize: 14, marginTop: 2 }}>{group.name}</div>
        <div style={{ color: '#9c9ca3', fontSize: 13, marginTop: 8 }}>
          {riders.length} rider{riders.length === 1 ? '' : 's'} booked · {signed}/{riders.length} waivers signed
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

function PrePickupState({ group }) {
  const riders = flattenMembers(group)
  const signed = riders.filter(r => r.has_signed_waiver).length
  const stops = Array.isArray(group?.schedule) ? group.schedule : []
  const countdown = minutesUntil(group.pickup_time)

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
          {riders.length} rider{riders.length === 1 ? '' : 's'} · {signed}/{riders.length} waivers signed
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

function InProgressState({ group, currentIdx }) {
  const riders = flattenMembers(group)
  const stops = Array.isArray(group?.schedule) ? group.schedule : []
  const currentStop = stops[currentIdx]

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
      </Hero>

      <section style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
        overflow: 'hidden', marginTop: 14,
      }}>
        <iframe
          src={TRACK_URL}
          title="Live Shuttle"
          style={{ width: '100%', height: 320, border: 0, display: 'block' }}
        />
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

function Hero({ children }) {
  return (
    <section style={{
      background: SURFACE, border: `1px solid ${ACCENT}`, borderRadius: 14, padding: 18,
    }}>
      {children}
    </section>
  )
}

function flattenMembers(group) {
  if (!group?.group_members) return []
  return group.group_members.map(m => ({
    member_id: m.id,
    current_stop_index: m.current_stop_index,
    id: m.contacts?.id,
    first_name: m.contacts?.first_name || '',
    last_name: m.contacts?.last_name || '',
    phone: m.contacts?.phone || null,
    has_signed_waiver: !!m.contacts?.has_signed_waiver,
  }))
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
