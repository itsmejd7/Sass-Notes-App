import { useNavigate, NavLink } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantSlug');
    navigate('/login');
  };
  return (
    <nav className="container" style={{ padding: '12px 0', marginBottom: 16, borderBottom: '1px solid #1f2937' }}>
      <div className="between">
        <div className="row">
          <span style={{ fontWeight: 700 }}>SaaS Notes</span>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/notes">Notes</NavLink>
        </div>
        <button onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}
