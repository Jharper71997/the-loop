'use client'

import { formatEventDate } from './util'

// Loop filter UI for the contacts list: quick chips + a date picker + a
// dropdown fallback when there are many loops. Extracted from contacts/page.js.
//
// Props:
//   loopFilter       — currently selected loop id ('' = all)
//   loopOptions      — dated groups, newest first
//   tonightLoop      — today's loop or null
//   datePicked       — selected date string ('' = none)
//   activeLoop       — the loop matching loopFilter or null
//   dateMissedLookup — true when a date was picked with no matching loop
//   onSelectLoop(id) — chip click (clears selection set in parent)
//   onSelectDate(iso)— date picker change
//   onSelectLoopFromDropdown(id) — dropdown change (also clears date)
export default function LoopFilterChips({
  loopFilter, loopOptions, tonightLoop, datePicked, activeLoop, dateMissedLookup,
  onSelectLoop, onSelectDate, onSelectLoopFromDropdown,
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        <FilterChip active={!loopFilter} onClick={() => onSelectLoop('')} label="All contacts" />
        {tonightLoop && (
          <FilterChip active={loopFilter === tonightLoop.id} onClick={() => onSelectLoop(tonightLoop.id)} label="Tonight's Loop" />
        )}
        {loopOptions.slice(0, 6).map(g => {
          if (tonightLoop && g.id === tonightLoop.id) return null
          return (
            <FilterChip
              key={g.id}
              active={loopFilter === g.id}
              onClick={() => onSelectLoop(g.id)}
              label={formatEventDate(g.event_date) || g.name || 'Loop'}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 8px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#9c9ca3', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Pick a date:
          <input
            type="date"
            value={datePicked}
            onChange={e => onSelectDate(e.target.value)}
            style={{
              background: datePicked ? '#2a2316' : '#121215',
              color: datePicked ? '#f0c040' : '#c8c8cc',
              border: `1px solid ${datePicked ? '#3a3220' : '#2a2a31'}`,
              borderRadius: 8, padding: '8px 10px', fontSize: 13, colorScheme: 'dark', margin: 0,
            }}
          />
        </label>
        {datePicked && (
          <button
            onClick={() => onSelectDate('')}
            style={{
              background: 'none', color: '#9c9ca3', border: '1px solid #2a2a31',
              padding: '6px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            }}
          >
            Clear date
          </button>
        )}
      </div>

      {loopOptions.length > 6 && (
        <select
          value={loopFilter}
          onChange={e => onSelectLoopFromDropdown(e.target.value)}
          style={{
            width: '100%',
            background: loopFilter ? '#2a2316' : '#121215',
            color: loopFilter ? '#f0c040' : '#c8c8cc',
            border: `1px solid ${loopFilter ? '#3a3220' : '#1e1e23'}`,
            borderRadius: 8, padding: '10px 12px', fontSize: 14, margin: '0 0 8px',
          }}
        >
          <option value="">— Pick any Loop —</option>
          {loopOptions.map(g => (
            <option key={g.id} value={g.id}>
              {formatEventDate(g.event_date)}{g.pickup_time ? ` · ${g.pickup_time}` : ''}{g.name ? ` — ${g.name}` : ''}
            </option>
          ))}
        </select>
      )}

      {dateMissedLookup && (
        <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 8px' }}>
          No Loop on {formatEventDate(datePicked)}.
        </p>
      )}
      {activeLoop && (
        <p style={{ color: '#f0c040', fontSize: 12, margin: '0 0 8px' }}>
          Showing riders from {formatEventDate(activeLoop.event_date) || activeLoop.name}
        </p>
      )}
    </>
  )
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${active ? '#d4a333' : '#2a2a31'}`,
        background: active ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : 'transparent',
        color: active ? '#0a0a0b' : '#c8c8cc',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: active ? '0 0 16px rgba(212,163,51,0.35)' : 'none',
      }}
    >
      {label}
    </button>
  )
}
