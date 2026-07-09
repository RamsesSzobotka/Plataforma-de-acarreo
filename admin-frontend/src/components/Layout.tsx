import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/reports', label: 'Informes', icon: 'bar_chart' },
  { to: '/users', label: 'Usuarios', icon: 'group' },
  { to: '/drivers', label: 'Conductores', icon: 'local_shipping' },
  { to: '/rides', label: 'Pedidos', icon: 'inventory_2' },
  { to: '/disputes', label: 'Disputas', icon: 'gavel' },
]

export default function Layout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  useEffect(() => {
    const userData = localStorage.getItem('adminUser')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  useEffect(() => {
    const check = () => {
      fetch('/health')
        .then(r => setBackendStatus(r.ok ? 'connected' : 'disconnected'))
        .catch(() => setBackendStatus('disconnected'))
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
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
          {/* Health indicator */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Servidor:
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
              background: backendStatus === 'connected' ? '#22C55E'
                : backendStatus === 'disconnected' ? '#EF4444'
                : '#F59E0B',
            }} />
            {backendStatus === 'connected' ? 'Conectado'
              : backendStatus === 'disconnected' ? 'Desconectado'
              : 'Verificando...'}
          </span>

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