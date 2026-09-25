'use client'

// One assigned person on one night, as leadership sees it on /admin/schedule.
// Tapping the pill unassigns them, and on a phone that pill sits right under a
// thumb, so it asks first.

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

export default function CrewShiftPill({ shift, action, nightLabel, style }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Take ${shift.person_name} off ${nightLabel}?`)) e.preventDefault()
      }}
      style={{ margin: 0 }}
    >
      <input type="hidden" name="id" value={shift.id} />
      <button
        type="submit"
        title={shift.notes ? `${shift.notes}\n(tap to unassign)` : 'Tap to unassign'}
        style={{
          background: style.bg,
          color: style.fg,
          border: `1px solid ${style.border}`,
          fontFamily: FONT_BODY,
          fontSize: 12,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 999,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {shift.person_name}
        <span style={{ opacity: 0.6, fontSize: 11 }}>×</span>
      </button>
    </form>
  )
}
