'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { personalize } from '@/lib/personalize'

export default function Home() {
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [groupMessage, setGroupMessage] = useState({})
  const [sending, setSending] = useState({})

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [g, m, c] = await Promise.all([
      supabase.from('groups').select('*').order('event_date'),
      supabase.from('group_members').select('id, group_id, contact_id'),
      supabase.from('contacts').select('id, first_name, last_name, phone'),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setContacts(c.data || [])
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

  async function sendGroupSMS(night) {
    const template = groupMessage[night.group.id]
    if (!template) return alert('Type a message first')
    const riders = night.riders.filter(r => r.phone)
    if (!riders.length) return alert('No riders with phones.')
    if (!confirm(`Send a personalized text to ${riders.length} rider${riders.length === 1 ? '' : 's'}?`)) return

    setSending(s => ({ ...s, [night.group.id]: true }))
    const results = await Promise.all(
      riders.map(r =>
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: r.phone, message: personalize(template, r) }),
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }))
      )
    )
    setSending(s => ({ ...s, [night.group.id]: false }))
    const failed = results.filter(r => !r.success).length
    if (failed === 0) {
      alert(`Sent to ${riders.length} rider${riders.length === 1 ? '' : 's'}!`)
      setGroupMessage(m => ({ ...m, [night.group.id]: '' }))
    } else {
      alert(`Sent to ${riders.length - failed} of ${riders.length}. ${failed} failed.`)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const upcoming = useMemo(() => {
    const contactById = new Map(contacts.map(c => [c.id, c]))
    const ridersByGroup = new Map()

    for (const m of members) {
      const rider = contactById.get(m.contact_id)
      if (!rider) continue
      if (!ridersByGroup.has(m.group_id)) ridersByGroup.set(m.group_id, [])
      ridersByGroup.get(m.group_id).push(rider)
    }

    const q = search.trim().toLowerCase()
    const matches = (r) =>
      !q || `${r.first_name || ''} ${r.last_name || ''} ${r.phone || ''}`
        .toLowerCase().includes(q)

    return groups
      .filter(g => !g.event_date || g.event_date >= today)
      .map(g => ({
        group: g,
        riders: (ridersByGroup.get(g.id) || [])
          .filter(matches)
          .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')),
      }))
      .filter(n => n.riders.length || !search)
      .sort((a, b) => (a.group.event_date || '').localeCompare(b.group.event_date || ''))
  }, [groups, members, contacts, search, today])

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
            : `Imported: ${importResult.ridersUpserted} riders across ${importResult.ordersProcessed} orders.${importResult.errorCount ? ` ${importResult.errorCount} errors.` : ''}`}
        </div>
      )}

      <input
        placeholder="Search by name or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f0c040', marginTop: '16px' }}>
        🟢 Active — Upcoming
      </h2>

      {upcoming.length === 0 && (
        <p style={{ color: '#888', textAlign: 'center', fontSize: '14px', margin: '20px 0' }}>
          No upcoming nights with riders yet.
        </p>
      )}

      {upcoming.map(n => (
        <div key={n.group.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <div>
              <p style={{ fontWeight: 600, color: '#f0c040', fontSize: '15px' }}>
                {formatEventDate(n.group.event_date) || n.group.name}
              </p>
              {n.group.pickup_time && (
                <p style={{ color: '#888', fontSize: '13px' }}>Pickup {n.group.pickup_time}</p>
              )}
            </div>
            <span style={{ color: '#888', fontSize: '13px' }}>
              {n.riders.length} rider{n.riders.length === 1 ? '' : 's'}
            </span>
          </div>

          {n.riders.length > 0 && (
            <div style={{ borderTop: '1px solid #2a2a2a', marginTop: '4px' }}>
              {n.riders.map(r => (
                <div
                  key={r.id}
                  style={{
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
          )}

          <div style={{ marginTop: '12px', borderTop: '1px solid #2a2a2a', paddingTop: '12px' }}>
            <p style={{ color: '#888', fontSize: '12px', marginBottom: '6px' }}>
              Text this night. Use <code>{'{first_name}'}</code> to personalize.
            </p>
            <textarea
              rows={2}
              placeholder="Hey {first_name}, pickup in 10 min..."
              value={groupMessage[n.group.id] || ''}
              onChange={e => setGroupMessage({ ...groupMessage, [n.group.id]: e.target.value })}
            />
            <button
              className="btn-primary"
              onClick={() => sendGroupSMS(n)}
              disabled={sending[n.group.id] || n.riders.length === 0}
            >
              {sending[n.group.id] ? 'Sending…' : `Send to ${n.riders.length} rider${n.riders.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      ))}
    </main>
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
