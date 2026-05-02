// Shared form chrome for /leadership entry forms. Server component.

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_NUM = '"JetBrains Mono", ui-monospace, monospace'

export default function FormShell({ title, subtitle, backTo, children }) {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {backTo && (
          <a href={backTo} style={{
            color: '#9c9ca3',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 16,
          }}>
            ← Back
          </a>
        )}
        <h1 style={{
          color: '#e8e8ea',
          fontFamily: FONT_BODY,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          margin: '0 0 4px 0',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            color: '#9c9ca3',
            fontSize: 13,
            margin: '0 0 22px 0',
          }}>
            {subtitle}
          </p>
        )}
        <div style={{
          background: '#121216',
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

export function Field({ label, name, type = 'text', placeholder, defaultValue, required = false, step, min, max, autoFocus = false, hint }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        color: '#9c9ca3',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
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
          fontFamily: type === 'number' ? FONT_NUM : FONT_BODY,
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
          fontSize: 11,
          marginTop: 4,
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
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
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
          fontFamily: FONT_BODY,
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
        <div style={{ color: '#6f6f76', fontSize: 11, marginTop: 4 }}>
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
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
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
          fontFamily: FONT_BODY,
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
      background: '#d4a333',
      color: '#0a0a0b',
      border: 'none',
      fontFamily: FONT_BODY,
      fontSize: 14,
      fontWeight: 600,
      padding: '12px 20px',
      borderRadius: 6,
      cursor: 'pointer',
      width: '100%',
      marginTop: 6,
    }}>
      {children}
    </button>
  )
}
