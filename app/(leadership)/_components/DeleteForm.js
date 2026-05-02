'use client'

// Tiny client wrapper around a server-action delete form.
// Renders a button styled red and intercepts submit with a window.confirm.

export default function DeleteForm({ action, label = 'Delete', confirmMessage = 'Delete this record? This cannot be undone.' }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
      style={{ margin: 0 }}
    >
      <button type="submit" style={{
        background: 'transparent',
        color: '#c44a3a',
        border: '1px solid rgba(196,74,58,0.4)',
        fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        padding: '8px 14px',
        borderRadius: 6,
        cursor: 'pointer',
      }}>
        {label}
      </button>
    </form>
  )
}
