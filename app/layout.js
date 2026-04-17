import './globals.css'
import NavBar from './NavBar'

export const metadata = {
  title: 'The Loop',
  description: 'Jville Brew Loop Operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}
