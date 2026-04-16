import './globals.css'

export const metadata = {
  title: 'The Loop',
  description: 'Jville Brew Loop Operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          background: '#0a0a0b',
          borderBottom: '1px solid #1e1e23',
          padding: '14px 20px',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <span style={{ color: '#d4a333', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>
            The Loop
          </span>
          <a href="/dashboard" style={{ color: '#c8c8cc', textDecoration: 'none', fontSize: '14px' }}>Dashboard</a>
          <a href="/" style={{ color: '#c8c8cc', textDecoration: 'none', fontSize: '14px' }}>Riders</a>
          <a href="/contacts" style={{ color: '#c8c8cc', textDecoration: 'none', fontSize: '14px' }}>Contacts</a>
          <a href="/groups" style={{ color: '#c8c8cc', textDecoration: 'none', fontSize: '14px' }}>Loops</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
