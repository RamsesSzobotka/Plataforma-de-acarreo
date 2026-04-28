import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/users', label: 'Usuarios', icon: 'group' },
  { to: '/drivers', label: 'Conductores', icon: 'local_shipping' },
  { to: '/rides', label: 'Pedidos', icon: 'inventory_2' },
]

export default function Layout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('adminUser')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  function handleLogout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="material-symbols-rounded icon">local_shipping</span>
          <h1>
            Plataforma de
            <span>Acarreos</span>
          </h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="material-symbols-rounded">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {/* Header con usuario y logout */}
        <header style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          gap: '1rem',
          padding: '1rem',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '1.5rem'
        }}>
          {user && (
            <span style={{ color: '#64748B', fontSize: '0.875rem' }}>
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: '#64748B',
            }}
          >
            Cerrar Sesión
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  )
}