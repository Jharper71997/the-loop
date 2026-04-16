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
          background: '#0d0d0d',
          borderBottom: '1px solid #f0c040',
          padding: '12px 24px',
          display: 'flex',
          gap: '24px',
          alignItems: 'center'
        }}>
          <span style={{ color: '#f0c040', fontWeight: 'bold', fontSize: '18px' }}>
            The Loop
          </span>
          <a href="/" style={{ color: '#f0f0f0', textDecoration: 'none', fontSize: '14px' }}>Riders</a>
          <a href="/groups" style={{ color: '#f0f0f0', textDecoration: 'none', fontSize: '14px' }}>Groups</a>
        </nav>
        {children}
      </body>
    </html>
  )
}