import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth, UserButton } from '@clerk/clerk-react'

function Layout() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            Plataforma de Acarreos
          </Link>
          
          <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isSignedIn ? (
              <>
                <Link to="/my-rides">Mis Pedidos</Link>
                <Link to="/create-ride" className="btn btn-primary">Nuevo Pedido</Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Iniciar Sesión
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        padding: '1rem',
        textAlign: 'center',
        color: 'var(--text-muted)'
      }}>
        <div className="container">
          <p>&copy; 2026 Plataforma de Acarreos</p>
        </div>
      </footer>
    </div>
  )
}

export default Layout