import Navbar from '../components/Navbar.jsx'

export default function Dashboard() {
  return (
    <div>
      <Navbar />
      <div className="container" style={{ textAlign: 'left' }}>
        <div className="panel" style={{ maxWidth: 720, margin: '24px auto' }}>
          <h1 style={{ marginTop: 0 }}>Welcome to SaaS Notes</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 0 }}>Use the navigation to manage your notes.</p>
        </div>
      </div>
    </div>
  )
}


