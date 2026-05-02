// Shared form chrome for /leadership entry forms. Server component.
//
// Usage:
//   <FormShell title="Record Bank Balance" backTo="/leadership/cash">
//     <form action={action}>...</form>
//   </FormShell>

export default function FormShell({ title, subtitle, backTo, children }) {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {backTo && (
          <a href={backTo} style={{
            color: '#9c9ca3',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 18,
          }}>
            ← Back
          </a>
        )}
        <h1 style={{
          color: '#d4a333',
          fontFamily: "'Orbitron', system-ui, sans-serif",
          fontSize: 22,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          margin: '0 0 6px 0',
          textShadow: '0 0 14px rgba(212,163,51,0.45)',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            color: '#9c9ca3',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: '0 0 22px 0',
          }}>
            {subtitle}
          </p>
        )}
        <div style={{
          background: 'linear-gradient(180deg, #121216, #0d0d10)',
          border: '1px solid #2a2a31',
          borderRadius: 8,
          padding: '20px 22px',
        }}>
          {children}
        </div>
      </div>
    </main>
  )
}

// Shared input / label styling for forms. Use as components inside <form>.

export function Field({ label, name, type = 'text', placeholder, defaultValue, required = false, step, min, max, autoFocus = false, hint }) {
  return (
    <label style={{
      display: 'block',
      marginBottom: 14,
    }}>
      <div style={{
        color: '#9c9ca3',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {label} {required && <span style={{ color: '#d4a333' }}>*</span>}
      </div>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        step={step}
        min={min}
        max={max}
        autoFocus={autoFocus}
        style={{
          background: '#0d0d10',
          border: '1px solid #2a2a31',
          color: '#e8e8ea',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 14,
          padding: '10px 12px',
          borderRadius: 6,
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {hint && (
        <div style={{
          color: '#6f6f76',
          fontSize: 10,
          marginTop: 4,
          fontStyle: 'italic',
        }}>
          {hint}
        </div>
      )}
    </label>
  )
}

export function Select({ label, name, options, defaultValue, required = false, hint }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        color: '#9c9ca3',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {label} {required && <span style={{ color: '#d4a333' }}>*</span>}
      </div>
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        style={{
          background: '#0d0d10',
          border: '1px solid #2a2a31',
          color: '#e8e8ea',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 14,
          padding: '10px 12px',
          borderRadius: 6,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && (
        <div style={{
          color: '#6f6f76',
          fontSize: 10,
          marginTop: 4,
          fontStyle: 'italic',
        }}>
          {hint}
        </div>
      )}
    </label>
  )
}

export function Textarea({ label, name, placeholder, defaultValue, required = false, rows = 3 }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        color: '#9c9ca3',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <textarea
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        rows={rows}
        style={{
          background: '#0d0d10',
          border: '1px solid #2a2a31',
          color: '#e8e8ea',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 14,
          padding: '10px 12px',
          borderRadius: 6,
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
        }}
      />
    </label>
  )
}

export function SubmitButton({ children = 'Save' }) {
  return (
    <button type="submit" style={{
      background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
      color: '#0a0a0b',
      border: '1px solid rgba(0,0,0,0.4)',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      padding: '12px 20px',
      borderRadius: 6,
      cursor: 'pointer',
      width: '100%',
      boxShadow: '0 0 20px rgba(212,163,51,0.35)',
      marginTop: 6,
    }}>
      {children}
    </button>
  )
}
