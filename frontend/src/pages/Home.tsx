import { useNavigate } from 'react-router-dom'
import { SignInButton, useUser } from '@clerk/clerk-react'
import { useEffect } from 'react'

function Home() {
  const { user, isSignedIn } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (isSignedIn && user) {
      // Redirect based on role
      // TODO: Check role from metadata
      navigate('/my-rides')
    }
  }, [isSignedIn, user])

  return (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        Plataforma de Acarreos
      </h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Tu solución para.acarreos locales. Conecta con conductores confiables cerca de ti.
      </p>

      {!isSignedIn && (
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <SignInButton mode="modal">
            <button className="btn btn-primary">
              Iniciar Sesión
            </button>
          </SignInButton>
        </div>
      )}

      {/* Features */}
      <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>📦 multiple Imágenes</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Sube varias fotos de lo que necesitas transportar
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>📍 Tracking en Tiempo Real</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Sigue el recorrido de tu acarreo en el mapa
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>💬 Chat Directo</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Comunícate directamente con el conductor
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>⭐ Calificaciones</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Cada usuario tiene perfil público con rating
          </p>
        </div>
      </div>
    </div>
  )
}

export default Home