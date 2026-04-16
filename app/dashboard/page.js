'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [c, g, m] = await Promise.all([
      supabase.from('contacts').select('id, sms_consent, created_at'),
      supabase.from('groups').select('id, event_date, tt_event_id'),
      supabase.from('group_members').select('id, group_id, contact_id'),
    ])
    setContacts(c.data || [])
    setGroups(g.data || [])
    setMembers(m.data || [])
  }

  const today = new Date().toISOString().slice(0, 10)

  const stats = useMemo(() => {
    const groupById = new Map(groups.map(g => [g.id, g]))

    const uniqueRiders = new Set()
    let upcomingRides = 0
    let totalRides = 0
    const ridersByNight = new Map()

    for (const m of members) {
      const g = groupById.get(m.group_id)
      if (!g) continue
      uniqueRiders.add(m.contact_id)
      totalRides++
      if (g.event_date && g.event_date >= today) upcomingRides++
      if (g.event_date) {
        if (!ridersByNight.has(g.event_date)) ridersByNight.set(g.event_date, 0)
        ridersByNight.set(g.event_date, ridersByNight.get(g.event_date) + 1)
      }
    }

    const allNights = Array.from(ridersByNight.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))

    const past4 = allNights.filter(([d]) => d < today).slice(0, 4)
    const avgPast4 = past4.length
      ? Math.round(past4.reduce((s, [, n]) => s + n, 0) / past4.length)
      : 0

    const upcoming = allNights.filter(([d]) => d >= today).reverse()
    const pastAll = allNights.filter(([d]) => d < today)

    const smsConsent = contacts.filter(c => c.sms_consent).length

    return {
      contacts: contacts.length,
      uniqueRiders: uniqueRiders.size,
      totalRides,
      upcomingRides,
      smsConsent,
      avgPast4,
      upcoming,
      past: pastAll,
    }
  }, [contacts, groups, members, today])

  return (
    <main>
      <h1>Dashboard</h1>
      <p className="muted" style={{ marginBottom: '16px' }}>
        Jville Brew Loop · snapshot for {today}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <StatCard label="Contacts" value={stats.contacts} />
        <StatCard label="Unique riders" value={stats.uniqueRiders} />
        <StatCard label="Upcoming seats" value={stats.upcomingRides} accent />
        <StatCard label="Avg last 4 nights" value={stats.avgPast4} />
        <StatCard label="SMS consent" value={`${stats.smsConsent}/${stats.contacts}`} />
        <StatCard label="Total rides" value={stats.totalRides} />
      </div>

      <h2>Upcoming nights</h2>
      {stats.upcoming.length === 0 ? (
        <p className="muted">No nights booked yet.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {stats.upcoming.map(([date, count], i) => (
            <NightRow key={date} date={date} count={count} first={i === 0} />
          ))}
        </div>
      )}

      <h2>Last 8 nights</h2>
      {stats.past.length === 0 ? (
        <p className="muted">No past nights recorded.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {stats.past.slice(0, 8).map(([date, count], i) => (
            <NightRow key={date} date={date} count={count} first={i === 0} />
          ))}
        </div>
      )}
    </main>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="card card-compact" style={{ marginBottom: 0, background: accent ? '#1c1a10' : '#121215' }}>
      <p style={{ fontSize: '11px', color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 700, color: accent ? '#d4a333' : '#e8e8ea', marginTop: '2px' }}>{value}</p>
    </div>
  )
}

function NightRow({ date, count, first }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderTop: first ? 'none' : '1px solid #1a1a1f',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: '14px', color: '#e8e8ea' }}>{formatDate(date)}</span>
      <span className="chip">{count} rider{count === 1 ? '' : 's'}</span>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}
