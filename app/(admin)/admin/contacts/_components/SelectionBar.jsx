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
        background: 'linear-gradient(180deg, #ffffff, #f3ecdd)',
        border: '1px solid #e8ddc8',
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
      <div style={{ color: '#17130f', fontSize: 13 }}>
        <span style={{ color: '#8a5f0a', fontWeight: 700 }}>{count}</span> selected
      </div>
      <button
        onClick={onClear}
        style={{ background: 'none', color: '#6e6154', border: 0, fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}
      >
        Clear
      </button>
      <button
        onClick={onMessage}
        style={{
          padding: '10px 18px', borderRadius: 10, border: 0,
          background: 'linear-gradient(180deg, #f0c24a, #d4a333)', color: '#231903',
          fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        Message {count}
      </button>
      <button
        onClick={onDelete}
        style={{
          padding: '10px 16px', borderRadius: 10, border: '1px solid #fdeae6',
          background: 'transparent', color: '#b3311f',
          fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        Delete {count}
      </button>
    </div>
  )
}
