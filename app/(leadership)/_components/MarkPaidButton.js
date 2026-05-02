'use client'

// Tiny client wrapper around a server-action form. Renders a single
// "Mark paid" button styled as a row-level action. The action prop is
// the bound server action (e.g., markSponsorPaid.bind(null, sponsor.id)).

export default function MarkPaidButton({ action, label = 'Mark paid' }) {
  return (
    <form action={action} style={{ margin: 0, display: 'inline' }}>
      <button type="submit" style={{
        background: 'transparent',
        color: '#3fb27f',
        border: '1px solid rgba(63,178,127,0.45)',
        fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </button>
    </form>
  )
}
