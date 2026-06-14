'use client'

import { useState } from 'react'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

// Collapsible section. Default-collapses non-essential content on the busiest
// pages while keeping every feature reachable. Children are server-rendered and
// passed in as props, so wrapping them here does NOT turn the page into a client
// component — only this toggle hydrates.
//
//   <ShowMore label="Older months" count={12}>{<Table/>}</ShowMore>
export default function ShowMore({ label = 'Show more', count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: '1px solid #2a2a31',
          color: '#9c9ca3',
          fontFamily: FONT_BODY,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '8px 12px',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 38,
        }}
      >
        <span style={{ color: '#d4a333' }}>{open ? '▴' : '▾'}</span>
        {open ? 'Hide' : label}
        {!open && count != null && (
          <span style={{ color: '#6f6f76' }}>({count})</span>
        )}
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}
