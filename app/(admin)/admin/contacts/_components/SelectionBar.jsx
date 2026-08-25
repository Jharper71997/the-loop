'use client'

// Fixed bottom action bar shown when contacts are multi-selected.
// Extracted from contacts/page.js. Pure presentational — the parent owns the
// selection set and supplies the handlers.
export default function SelectionBar({ count, onClear, onMessage, onDelete }) {
  if (count <= 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(20px, calc(20px + env(safe-area-inset-bottom)))',
        transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'linear-gradient(180deg, #1a1a22, #121216)',
        border: '1px solid #2a2a31',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,163,51,0.15)',
        borderRadius: 14,
        padding: '10px 12px 10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 24px)',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: '#e8e8ea', fontSize: 13 }}>
        <span style={{ color: '#f0c24a', fontWeight: 700 }}>{count}</span> selected
      </div>
      <button
        onClick={onClear}
        style={{ background: 'none', color: '#9c9ca3', border: 0, fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}
      >
        Clear
      </button>
      <button
        onClick={onMessage}
        style={{
          padding: '10px 18px', borderRadius: 10, border: 0,
          background: 'linear-gradient(180deg, #f0c24a, #d4a333)', color: '#0a0a0b',
          fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        Message {count}
      </button>
      <button
        onClick={onDelete}
        style={{
          padding: '10px 16px', borderRadius: 10, border: '1px solid #3a1f1f',
          background: 'transparent', color: '#e07a7a',
          fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        Delete {count}
      </button>
    </div>
  )
}
