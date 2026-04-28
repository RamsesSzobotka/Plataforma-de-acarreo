import { Outlet, Link } from 'react-router-dom'
import { useAuth, UserButton } from '@clerk/clerk-react'

function Layout() {
  const { isSignedIn } = useAuth()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: '#0F172A',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '1rem',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#FFFFFF' }}>
            <span className="material-symbols-rounded" style={{ color: '#0D9488' }}>local_shipping</span>
            <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Plataforma de Acarreos</span>
          </Link>
          
          <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isSignedIn ? (
              <>
                <Link to="/my-rides" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontFamily: '"Inter", sans-serif', fontSize: '0.9rem' }}>Mis Pedidos</Link>
                <Link to="/create-ride" style={{ background: '#0D9488', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: '600', fontSize: '0.9rem' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
                  Nuevo Pedido
                </Link>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: { width: '36px', height: '36px' }
                    }
                  }}
                />
              </>
            ) : (
              <Link to="/sign-in" style={{ background: '#0D9488', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: '600', fontSize: '0.9rem' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>login</span>
                Iniciar Sesion
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem 0', background: '#0F172A' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: '#0F172A',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '1.5rem',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: '"Inter", sans-serif',
        fontSize: '0.875rem'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
          <p>2026 Plataforma de Acarreos</p>
        </div>
      </footer>
    </div>
  )
}

export default Layout