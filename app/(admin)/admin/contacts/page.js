'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SmsButton from '../../_components/SmsButton'
import BroadcastModal from './_components/BroadcastModal'
import ContactDetail from './_components/ContactDetail'
import SelectionBar from './_components/SelectionBar'
import LoopFilterChips from './_components/LoopFilterChips'
import { formatEventDate } from './_components/util'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [loopFilter, setLoopFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [checkedIds, setCheckedIds] = useState(() => new Set())
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [datePicked, setDatePicked] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  // Deep-link support: /admin/contacts?id=<uuid> auto-opens that contact's
  // detail panel. Lets the StopCard rider names on /admin Schedule click
  // straight into the edit form.
  useEffect(() => {
    if (!contacts.length) return
    const params = new URLSearchParams(window.location.search)
    const wantId = params.get('id')
    if (!wantId) return
    const match = contacts.find(c => c.id === wantId)
    if (match && (!selected || selected.id !== wantId)) {
      setSelected(match)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts])

  async function refresh() {
    const [c, g, m] = await Promise.all([
      supabase.from('contacts').select('*').order('last_name'),
      // Brew Loop admin only — exclude Marines/Surf groups from the assign dropdown.
      supabase.from('groups').select('*').eq('kind', 'brew'),
      supabase.from('group_members').select('id, group_id, contact_id'),
    ])
    setContacts(c.data || [])
    setGroups(g.data || [])
    setMembers(m.data || [])
  }

  // Operational date in the Indianapolis TZ — UTC midnight rolls over at 8pm
  // local, which would hide tonight's Loop from the assign dropdown after
  // dinner. The schedule helper already does this calc for /admin Tonight.
  const today = (() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Indiana/Indianapolis',
        year: 'numeric', month: '2-digit', day: '2-digit',
      })
      return fmt.format(new Date())
    } catch {
      return new Date().toISOString().slice(0, 10)
    }
  })()

  const enriched = useMemo(() => {
    const groupById = new Map(groups.map(g => [g.id, g]))
    const ridesByContact = new Map()

    for (const m of members) {
      const group = groupById.get(m.group_id)
      if (!group) continue
      if (!ridesByContact.has(m.contact_id)) ridesByContact.set(m.contact_id, [])
      ridesByContact.get(m.contact_id).push(group)
    }

    const q = search.trim().toLowerCase()
    const matches = (c) =>
      !q || `${c.first_name || ''} ${c.last_name || ''} ${c.phone || ''} ${c.email || ''}`
        .toLowerCase().includes(q)

    return contacts
      .filter(matches)
      .map(c => {
        const rides = (ridesByContact.get(c.id) || [])
          .slice()
          .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
        // Open (not-closed-out) loops stay "current" until staff close them
        // out, so a Friday rider keeps showing as Booked through the weekend.
        const past = rides.filter(r => r.closed_out_at)
        const upcoming = rides.filter(r => !r.closed_out_at)
        return { ...c, rides, past, upcoming }
      })
      .filter(c => !loopFilter || c.rides.some(r => r.id === loopFilter))
      .sort((a, b) => {
        const aLast = a.past[0]?.event_date || ''
        const bLast = b.past[0]?.event_date || ''
        if (aLast && bLast) return bLast.localeCompare(aLast)
        if (aLast) return -1
        if (bLast) return 1
        return (a.last_name || '').localeCompare(b.last_name || '')
      })
  }, [contacts, groups, members, search, today, loopFilter])

  const loopOptions = useMemo(() => {
    return groups
      .filter(g => g.event_date)
      .slice()
      .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
  }, [groups])

  // These useMemos must run on every render — including when `selected` is set
  // and we early-return below — or React throws "rendered fewer hooks than
  // expected" and crashes the contact detail page.
  const broadcastTargets = useMemo(
    () => contacts.filter(c => checkedIds.has(c.id)),
    [contacts, checkedIds]
  )
  const tonightLoop = useMemo(() => {
    // The active open loop: today's if present, else the most recent loop that
    // ran but hasn't been closed out yet.
    const open = loopOptions.filter(g => !g.closed_out_at)
    return (
      open.find(g => g.event_date === today) ||
      open
        .filter(g => g.event_date && g.event_date <= today)
        .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))[0] ||
      null
    )
  }, [loopOptions, today])

  if (selected) {
    const detail = enriched.find(c => c.id === selected.id) || selected
    return (
      <ContactDetail
        key={detail.id}
        contact={detail}
        groups={groups}
        today={today}
        onBack={() => setSelected(null)}
        onRefresh={refresh}
      />
    )
  }

  const checkedCount = checkedIds.size

  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const visibleIds = enriched.map(c => c.id)
    const allChecked = visibleIds.every(id => checkedIds.has(id))
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (allChecked) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }

  const allVisibleChecked = enriched.length > 0 && enriched.every(c => checkedIds.has(c.id))
  const activeLoop = loopOptions.find(g => g.id === loopFilter) || null
  const dateMatchedLoop = datePicked ? loopOptions.find(g => g.event_date === datePicked) : null
  const dateMissedLookup = datePicked && !dateMatchedLoop

  function handleDatePick(iso) {
    setDatePicked(iso)
    setCheckedIds(new Set())
    const match = iso ? loopOptions.find(g => g.event_date === iso) : null
    setLoopFilter(match ? match.id : '')
  }

  function selectLoop(id) {
    setLoopFilter(id)
    setCheckedIds(new Set())
  }

  function selectLoopFromDropdown(id) {
    setLoopFilter(id)
    setCheckedIds(new Set())
    setDatePicked('')
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${checkedCount} contact${checkedCount === 1 ? '' : 's'}? This removes them from every Loop they're on.`)) return
    const ids = Array.from(checkedIds)
    const failures = []
    for (const id of ids) {
      try {
        const res = await fetch(`/api/admin/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          failures.push(`${id.slice(0, 6)}: ${j.error || res.status}`)
        }
      } catch (err) {
        failures.push(`${id.slice(0, 6)}: ${err?.message || 'network error'}`)
      }
    }
    setCheckedIds(new Set())
    refresh()
    if (failures.length) alert(`Some deletes failed:\n${failures.join('\n')}`)
  }

  return (
    <main style={{ paddingBottom: checkedCount > 0 ? 96 : undefined }}>
      <h1>Contacts</h1>

      <LoopFilterChips
        loopFilter={loopFilter}
        loopOptions={loopOptions}
        tonightLoop={tonightLoop}
        datePicked={datePicked}
        activeLoop={activeLoop}
        dateMissedLookup={dateMissedLookup}
        onSelectLoop={selectLoop}
        onSelectDate={handleDatePick}
        onSelectLoopFromDropdown={selectLoopFromDropdown}
      />

      <input
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 16px', gap: 12 }}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          {enriched.length} contact{enriched.length === 1 ? '' : 's'}
          {checkedCount > 0 && <span style={{ color: '#f0c24a' }}> · {checkedCount} selected</span>}
        </span>
        {enriched.length > 0 && (
          <button
            onClick={toggleAllVisible}
            style={{
              background: 'none', color: '#9c9ca3', border: '1px solid #2a2a31',
              padding: '4px 10px', borderRadius: 6, fontSize: 11,
              letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {allVisibleChecked ? 'Clear' : 'Select all visible'}
          </button>
        )}
      </div>

      <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #1e1e23', overflow: 'hidden' }}>
        {enriched.map((c, idx) => {
          const rides = c.past.length
          const hasUpcoming = c.upcoming.length > 0
          const checked = checkedIds.has(c.id)
          return (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              style={{
                padding: '12px 14px',
                borderTop: idx === 0 ? 'none' : '1px solid #1a1a1f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                background: checked ? 'rgba(212,163,51,0.06)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <label
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: 4, margin: -4 }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCheck(c.id)}
                  style={{ width: 18, height: 18, accentColor: '#d4a333', cursor: 'pointer', margin: 0 }}
                />
              </label>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#e8e8ea' }}>
                  {c.first_name} {c.last_name}
                </p>
                <p style={{ fontSize: '12px', color: '#6f6f76', marginTop: '2px' }}>
                  {c.phone}
                  {c.past[0]?.event_date && (
                    <span style={{ color: '#55555c' }}> · last {formatEventDate(c.past[0].event_date)}</span>
                  )}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {hasUpcoming && <span className="chip chip-green">Booked</span>}
                {rides > 0 && <span className="chip chip-gold">{rides}</span>}
                <span onClick={e => e.stopPropagation()}>
                  <SmsButton contact={c} />
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {enriched.length === 0 && (
        <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
          {search ? 'No contacts match that search.' : 'No contacts yet.'}
        </p>
      )}

      <SelectionBar
        count={checkedCount}
        onClear={() => setCheckedIds(new Set())}
        onMessage={() => setBroadcastOpen(true)}
        onDelete={deleteSelected}
      />

      {broadcastOpen && (
        <BroadcastModal
          contacts={broadcastTargets}
          onClose={() => setBroadcastOpen(false)}
        />
      )}
    </main>
  )
}
