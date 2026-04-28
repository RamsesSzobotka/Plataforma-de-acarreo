import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  FileCheck, 
  Route,
  LogOut,
  Menu
} from 'lucide-react'
import { useState } from 'react'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: 'Usuarios', icon: Users },
  { path: '/drivers', label: 'Conductores', icon: Truck },
  { path: '/drivers/pending', label: 'Verificar Drivers', icon: FileCheck },
  { path: '/rides', label: 'Pedidos', icon: Route }
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar - Desktop */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border)',
        padding: '1.5rem 1rem',
        display: 'none',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto'
      }} className="sidebar-desktop">
        <div style={{ marginBottom: '2rem', padding: '0 0.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={24} />
            Back Office
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Plataforma de Acarreos
          </p>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  marginBottom: '0.25rem',
                  textDecoration: 'none'
                }}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '1rem 0.5rem', borderTop: '1px solid var(--border)' }}>
          <Link 
            to="/" 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--text-muted)',
              fontSize: '0.875rem'
            }}
          >
            <LogOut size={18} />
            Cerrar sesión
          </Link>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1000,
          background: 'var(--bg-primary)',
          padding: '0.5rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        className="mobile-menu-btn"
      >
        <Menu size={24} />
      </button>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'block'
          }}
        />
      )}
      
      {sidebarOpen && (
        <aside style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '260px',
          height: '100vh',
          background: 'var(--bg-primary)',
          padding: '1.5rem 1rem',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.2s ease'
        }}>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
          
          <div style={{ marginBottom: '2rem', padding: '0 0.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={24} />
              Back Office
            </h1>
          </div>

          <nav>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                    marginBottom: '0.25rem',
                    textDecoration: 'none'
                  }}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>
      )}

      {/* Main content */}
      <main style={{
        flex: 1,
        padding: '2rem',
        marginLeft: '260px'
      }} className="main-content">
        {children}
      </main>

      <style>{`
        @media (min-width: 769px) {
          .sidebar-desktop {
            display: flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
          .main-content {
            marginLeft: 260px;
          }
        }
        @media (max-width: 768px) {
          .sidebar-desktop {
            display: none;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
          .main-content {
            marginLeft: 0;
            padding-top: 4rem;
          }
        }
      `}</style>
    </div>
  )
}