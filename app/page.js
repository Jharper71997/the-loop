'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [assignedGroup, setAssignedGroup] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [c, g, m] = await Promise.all([
      supabase.from('contacts').select('*').order('last_name'),
      supabase.from('groups').select('*').order('event_date'),
      supabase.from('group_members').select('id, group_id, contact_id'),
    ])
    setContacts(c.data || [])
    setGroups(g.data || [])
    setMembers(m.data || [])
  }

  async function assignToGroup() {
    if (!assignedGroup || !selected) return
    await supabase.from('group_members').insert([{
      group_id: assignedGroup,
      contact_id: selected.id,
    }])
    alert('Rider assigned to group!')
    refresh()
  }

  async function saveEdit() {
    await supabase.from('contacts').update(editForm).eq('id', selected.id)
    setSelected({ ...selected, ...editForm })
    setEditing(false)
    refresh()
  }

  async function deleteContact() {
    if (!confirm('Delete this rider?')) return
    await supabase.from('group_members').delete().eq('contact_id', selected.id)
    await supabase.from('contacts').delete().eq('id', selected.id)
    setSelected(null)
    refresh()
  }

  async function runImport() {
    if (!confirm('Import all historical riders from Ticket Tailor? Safe to re-run.')) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/backfill-riders', { method: 'POST' })
      const data = await res.json()
      setImportResult(data)
      if (data.ok) refresh()
    } catch (err) {
      setImportResult({ error: err.message })
    } finally {
      setImporting(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const sections = useMemo(() => {
    const contactById = new Map(contacts.map(c => [c.id, c]))
    const groupById = new Map(groups.map(g => [g.id, g]))

    const ridersByGroup = new Map()
    const groupDatesByContact = new Map()

    for (const m of members) {
      const rider = contactById.get(m.contact_id)
      const group = groupById.get(m.group_id)
      if (!rider || !group) continue

      if (!ridersByGroup.has(m.group_id)) ridersByGroup.set(m.group_id, [])
      ridersByGroup.get(m.group_id).push(rider)

      if (!groupDatesByContact.has(rider.id)) groupDatesByContact.set(rider.id, [])
      groupDatesByContact.get(rider.id).push(group.event_date)
    }

    const rideStats = new Map()
    for (const [contactId, dates] of groupDatesByContact) {
      const pastDates = dates.filter(d => d && d < today).sort()
      const upcomingDates = dates.filter(d => !d || d >= today).sort()
      rideStats.set(contactId, {
        rideCount: pastDates.length,
        lastRide: pastDates.length ? pastDates[pastDates.length - 1] : null,
        hasUpcoming: upcomingDates.length > 0,
      })
    }

    const q = search.trim().toLowerCase()
    const matches = (r) =>
      !q || `${r.first_name || ''} ${r.last_name || ''} ${r.phone || ''} ${r.email || ''}`
        .toLowerCase().includes(q)

    const upcoming = Array.from(ridersByGroup.entries())
      .map(([groupId, riders]) => ({
        group: groupById.get(groupId),
        riders: riders
          .filter(matches)
          .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')),
      }))
      .filter(n => n.group && (!n.group.event_date || n.group.event_date >= today) && n.riders.length)
      .sort((a, b) => (a.group.event_date || '').localeCompare(b.group.event_date || ''))

    const allRiders = contacts
      .filter(matches)
      .map(c => ({ ...c, ...(rideStats.get(c.id) || { rideCount: 0, lastRide: null, hasUpcoming: false }) }))
      .sort((a, b) => {
        if (a.lastRide && b.lastRide) return b.lastRide.localeCompare(a.lastRide)
        if (a.lastRide) return -1
        if (b.lastRide) return 1
        return (a.last_name || '').localeCompare(b.last_name || '')
      })

    return { upcoming, allRiders, total: contacts.length }
  }, [contacts, groups, members, search, today])

  if (selected) {
    return (
      <main>
        <button
          onClick={() => { setSelected(null); setEditing(false) }}
          style={{ color: '#f0c040', background: 'none', marginBottom: '16px', fontSize: '15px' }}
        >
          ← Back
        </button>

        <div className="card">
          {editing ? (
            <>
              <h3 style={{ marginBottom: '12px' }}>Edit Rider</h3>
              <input placeholder="First name" value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
              <input placeholder="Last name" value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
              <input placeholder="Phone" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              <input placeholder="Email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              <button className="btn-primary" onClick={saveEdit}>Save Changes</button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', color: '#888', marginTop: '8px', width: '100%' }}>Cancel</button>
            </>
          ) : (
            <>
              <p className="rider-name">{selected.first_name} {selected.last_name}</p>
              <p className="rider-phone">📞 {selected.phone}</p>
              <p className="rider-phone">✉️ {selected.email}</p>
              <button onClick={() => { setEditing(true); setEditForm(selected) }} style={{ background: 'none', color: '#f0c040', marginTop: '12px', fontSize: '14px' }}>Edit Rider</button>
              <button onClick={deleteContact} style={{ background: 'none', color: '#ff4444', marginTop: '4px', fontSize: '14px' }}>Delete Rider</button>
            </>
          )}
        </div>

        <div className="card">
          <h3>Assign to Group</h3>
          <select value={assignedGroup} onChange={e => setAssignedGroup(e.target.value)}>
            <option value="">Select a group...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}{g.pickup_time ? ` — ${g.pickup_time}` : ''}</option>
            ))}
          </select>
          <button className="btn-green" onClick={assignToGroup}>Assign Rider</button>
        </div>

        <div className="card">
          <h3>Send SMS</h3>
          <textarea rows={3} placeholder="Type your message..." value={message} onChange={e => setMessage(e.target.value)} />
          <button className="btn-primary" onClick={async () => {
            if (!message || !selected?.phone) return
            const res = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: selected.phone, message }),
            })
            const data = await res.json()
            if (data.success) { alert('Text sent!'); setMessage('') } else { alert('Error: ' + data.error) }
          }}>Send Text</button>
        </div>
      </main>
    )
  }

  return (
    <main>
      <h1>Riders</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={runImport}
          disabled={importing}
          style={{ flex: 1, background: '#1a1a1a', color: '#f0c040', border: '1px solid #2a2a2a', fontSize: '13px' }}
        >
          {importing ? 'Importing…' : '⬇ Import from Ticket Tailor'}
        </button>
        <button
          onClick={refresh}
          style={{ background: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a', fontSize: '13px' }}
        >
          ↻
        </button>
      </div>

      {importResult && (
        <div className="card" style={{ fontSize: '13px', color: importResult.error ? '#ff6666' : '#a0e0a0' }}>
          {importResult.error
            ? `Error: ${importResult.error}${importResult.detail ? ' — ' + importResult.detail : ''}`
            : `Imported: ${importResult.ridersUpserted} riders across ${importResult.ordersProcessed} orders (${importResult.pages} pages). ${importResult.ticketsSkipped || 0} voided tickets skipped.${importResult.errorCount ? ` ${importResult.errorCount} errors.` : ''}`}
        </div>
      )}

      <input
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div style={{ color: '#888', fontSize: '13px', margin: '4px 0 16px' }}>
        {sections.total} total riders
      </div>

      {sections.upcoming.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f0c040' }}>
            🟢 Active — Upcoming
          </h2>
          {sections.upcoming.map(n => (
            <NightSection key={n.group.id} night={n} onSelect={setSelected} />
          ))}
        </section>
      )}

      {sections.allRiders.length > 0 && (
        <section style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888' }}>
            All Riders ({sections.allRiders.length})
          </h2>
          {sections.allRiders.map(r => (
            <RiderRow key={r.id} rider={r} onSelect={setSelected} />
          ))}
        </section>
      )}

      {sections.upcoming.length === 0 && sections.allRiders.length === 0 && (
        <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
          {search ? 'No riders match that search.' : 'No riders yet. Try importing from Ticket Tailor above.'}
        </p>
      )}
    </main>
  )
}

function NightSection({ night, onSelect }) {
  const { group, riders } = night
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div>
          <p style={{ fontWeight: 600, color: '#f0c040', fontSize: '15px' }}>
            {formatEventDate(group.event_date) || group.name}
          </p>
          {group.pickup_time && (
            <p style={{ color: '#888', fontSize: '13px' }}>Pickup {group.pickup_time}</p>
          )}
        </div>
        <span style={{ color: '#888', fontSize: '13px' }}>
          {riders.length} rider{riders.length === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '4px' }}>
        {riders.map(r => (
          <div
            key={r.id}
            onClick={() => onSelect(r)}
            style={{
              cursor: 'pointer',
              padding: '8px 0',
              borderBottom: '1px solid #222',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="rider-name" style={{ fontSize: '15px' }}>
              {r.first_name} {r.last_name}
            </span>
            <span className="rider-phone" style={{ marginTop: 0 }}>{r.phone}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RiderRow({ rider, onSelect }) {
  const tag = rider.hasUpcoming
    ? { label: 'Booked', color: '#4aa84a', bg: '#1a2a1a' }
    : rider.rideCount > 0
      ? { label: `${rider.rideCount} ride${rider.rideCount === 1 ? '' : 's'}`, color: '#f0c040', bg: '#2a2316' }
      : { label: 'New', color: '#888', bg: '#1f1f1f' }

  return (
    <div
      className="card"
      onClick={() => onSelect(rider)}
      style={{ cursor: 'pointer', padding: '12px 14px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="rider-name" style={{ fontSize: '15px' }}>
            {rider.first_name} {rider.last_name}
          </p>
          <p className="rider-phone">
            {rider.phone}
            {rider.lastRide && (
              <span style={{ color: '#666', marginLeft: '8px' }}>
                · last rode {formatEventDate(rider.lastRide)}
              </span>
            )}
          </p>
        </div>
        <span style={{
          background: tag.bg,
          color: tag.color,
          fontSize: '11px',
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: '10px',
          whiteSpace: 'nowrap',
        }}>
          {tag.label}
        </span>
      </div>
    </div>
  )
}

function formatEventDate(iso) {
  if (!iso) return null
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}
