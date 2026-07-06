import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useSearchParams, Link } from 'react-router-dom'

/**
 * Página puente para el flujo OAuth 2.1.
 *
 * Claude Desktop abre esta página en su webview embebido cuando el backend
 * necesita autenticar al usuario. Como el frontend ya tiene Clerk configurado
 * correctamente, esta página:
 *
 * 1. Espera a que Clerk cargue
 * 2. Si el usuario no ha iniciado sesión, lo redirige a /sign-in
 * 3. Si ya inició sesión, obtiene el session_token de Clerk
 * 4. Redirige al backend con session_token para completar el authorize
 */
function OAuthLogin() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const redirect = searchParams.get('redirect')

  useEffect(() => {
    if (!isLoaded) return
    if (!redirect) {
      setError('Falta el parámetro "redirect" en la URL.')
      return
    }

    if (!isSignedIn) {
      // Guardar la URL actual para volver después del sign-in
      const returnUrl = encodeURIComponent(window.location.href)
      window.location.href = `/sign-in?redirect_url=${returnUrl}`
      return
    }

    // Usuario autenticado → obtener session_token y redirigir al backend
    getToken()
      .then((token) => {
        if (!token) {
          setError('No se pudo obtener el token de sesión.')
          return
        }
        const separator = redirect.includes('?') ? '&' : '?'
        window.location.href = `${redirect}${separator}session_token=${encodeURIComponent(token)}`
      })
      .catch((err) => {
        setError(`Error al obtener token: ${(err as Error).message}`)
      })
  }, [isLoaded, isSignedIn, redirect, getToken])

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8FAFC',
        fontFamily: 'Inter, sans-serif',
        padding: '1rem',
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#EF4444', marginBottom: '1rem' }}>
            error_outline
          </span>
          <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '1.25rem', color: '#0F172A', marginBottom: '0.5rem' }}>
            Error de autenticación
          </h1>
          <p style={{ color: '#64748B', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</p>
          <Link to="/" style={{
            display: 'inline-block',
            background: '#0D9488',
            color: '#FFFFFF',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: '#0D9488' }}>
          sync
        </span>
        <p style={{ color: '#64748B', marginTop: '0.75rem' }}>Conectando...</p>
      </div>
    </div>
  )
}

export default OAuthLogin
