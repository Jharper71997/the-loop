import NavBar from './_components/NavBar'

export default function AdminLayout({ children }) {
  return (
    <div className="hud-shell">
      <NavBar />
      {children}
    </div>
  )
}
