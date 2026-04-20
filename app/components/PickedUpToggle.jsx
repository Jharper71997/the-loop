'use client'

import { useState } from 'react'

const ACCENT = '#d4a333'

// Marks a rider as "picked up" by advancing their group_members.current_stop_index
// to the next stop. Default unchecked = at this stop. Checked = past this stop.
//
// Props:
//   memberId:   group_members.id
//   stopIndex:  the stop the rider is currently at
//   nextIndex:  index to advance to when checked (default stopIndex + 1)
//   initialPickedUp: bool — derived by parent from current_stop_index > stopIndex
export default function PickedUpToggle({ memberId, stopIndex, nextIndex, initialPickedUp = false }) {
  const [checked, setChecked] = useState(initialPickedUp)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    const next = !checked
    setBusy(true)
    setChecked(next)
    const target = next ? (nextIndex ?? stopIndex + 1) : stopIndex
    const res = await fetch(`/api/group-members?id=${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_stop_index: target }),
    }).catch(e => ({ ok: false, error: e.message }))
    if (!res.ok) {
      setChecked(!next) // revert
    }
    setBusy(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      style={{
        background: checked ? ACCENT : 'transparent',
        border: `1px solid ${checked ? ACCENT : '#2a2a31'}`,
        color: checked ? '#0a0a0b' : '#9c9ca3',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: checked ? 700 : 500,
        cursor: 'pointer',
        opacity: busy ? 0.5 : 1,
      }}
    >
      {checked ? '✓ picked up' : 'pick up'}
    </button>
  )
}
