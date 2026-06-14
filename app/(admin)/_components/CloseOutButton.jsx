'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#d4a333'
const BORDER = '#2a2a31'

// "Close out loop" — the manual save staff press to take a finished loop off the
// admin screens. Until pressed, the loop stays visible everywhere on the admin
// side regardless of date (driver numbers, tickets, waivers, messaging).
export default function CloseOutButton({ groupId, label = 'Close out loop' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function closeOut() {
    if (busy || !groupId) return
    if (!confirm('Close out this loop? It will come off the driver, tickets, waivers, and messaging screens. You can reopen it from the loop’s page if needed.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/close-loop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error || 'Could not close out the loop.')
        setBusy(false)
        return
      }
      router.refresh()
    } catch {
      alert('Network error. Please try again.')
      setBusy(false)
    }
  }

  return (
    <button
      onClick={closeOut}
      disabled={busy}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: busy ? 'transparent' : 'rgba(212,163,51,0.10)',
        color: ACCENT,
        fontSize: 12,
        fontWeight: 700,
        cursor: busy ? 'default' : 'pointer',
        minHeight: 36,
        display: 'inline-flex',
        alignItems: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? 'Saving…' : label}
    </button>
  )
}
