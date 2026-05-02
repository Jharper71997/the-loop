'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Triggers /api/leadership/payments/sync-stripe — pulls Stripe subscription
// invoices and mirrors them into sponsor_payments / bar_payments. Idempotent.

export default function StripeSyncButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/leadership/payments/sync-stripe', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setMsg({ kind: 'err', text: data.error || `Sync failed (${res.status})` })
      } else {
        const parts = []
        if (data.sponsor_payments_inserted) parts.push(`${data.sponsor_payments_inserted} sponsor`)
        if (data.bar_payments_inserted) parts.push(`${data.bar_payments_inserted} bar`)
        const inserted = parts.length ? parts.join(' + ') + ' payments inserted' : 'No new payments'
        const skipped = data.skipped_already_imported ? ` · ${data.skipped_already_imported} already imported` : ''
        const noMatch = data.skipped_no_match?.length
          ? ` · ${data.skipped_no_match.length} unmatched`
          : ''
        setMsg({ kind: 'ok', text: `${inserted}${skipped}${noMatch}` })
        router.refresh()
      }
    } catch (e) {
      setMsg({ kind: 'err', text: String(e?.message || e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        onClick={run}
        disabled={busy}
        style={{
          background: 'transparent',
          color: '#8b85ff',
          border: '1px solid rgba(99,91,255,0.45)',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 6,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Syncing…' : 'Sync Stripe payments'}
      </button>
      {msg && (
        <span style={{
          fontSize: 12,
          color: msg.kind === 'ok' ? '#3fb27f' : '#c44a3a',
        }}>
          {msg.text}
        </span>
      )}
    </div>
  )
}
