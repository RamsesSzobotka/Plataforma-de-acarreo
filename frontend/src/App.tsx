import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import Layout from './components/Layout'
import Home from './pages/Home'
import AuthPage from './pages/AuthPage'
import OAuthLogin from './pages/OAuthLogin'
import CreateRide from './pages/CreateRide'
import MyRides from './pages/MyRides'
import RideDetails from './pages/RideDetails'
import DriverDashboard from './pages/DriverDashboard'
import DriverProfile from './pages/DriverProfile'
import Chat from './pages/Chat'
import RegisterDriver from './pages/RegisterDriver'
import AddPaymentMethodPage from './pages/AddPaymentMethod'
import PaymentHistory from './pages/PaymentHistory'
import SettingsMcp from './pages/SettingsMcp'
import DriverPublicProfile from './pages/DriverPublicProfile'
import Notifications from './pages/Notifications'
import Privacy from './pages/Privacy'
import GdprSettings from './pages/GdprSettings'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { NotificationBadgeProvider } from './contexts/NotificationBadgeContext'
import ErrorBoundary from './components/ErrorBoundary'
import PageTransition from './components/PageTransition'
import { hideLoading, showLoading } from './services/alerts'
import ToastContainer from './components/Toast'

const API_URL = import.meta.env.VITE_API_URL || ''

function SessionLoading({ message }: { message: string }) {
  useEffect(() => {
    showLoading(message)
    return () => {
      hideLoading()
    }
  }, [message])

  return null
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <SessionLoading message="Cargando sesion..." />
  }
  
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }
  
  return <>{children}</>
}

// Public auth route: si ya hay sesion, evitar renderizar pantalla de login
function PublicAuthRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <SessionLoading message="Cargando sesion..." />
  }

  if (isSignedIn) {
    return <Navigate to="/my-rides" replace />
  }

  return <>{children}</>
}

function ConsentBanner() {
  const { isSignedIn, getToken } = useAuth()
  const [consented, setConsented] = useState(() => localStorage.getItem('gdpr_consent') === 'true')
  const [loading, setLoading] = useState(false)

  if (consented || !isSignedIn) return null

  const handleAccept = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/gdpr/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version: '1.0' }),
      })
      if (response.ok) {
        localStorage.setItem('gdpr_consent', 'true')
        setConsented(true)
      }
    } catch (err) {
      console.error('Error al guardar consentimiento:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-primary)',
      borderTop: '2px solid var(--border)',
      padding: '1rem 2rem',
      zIndex: 1000,
      boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Utilizamos tus datos solo para el funcionamiento de la plataforma. Al aceptar, confirmas que has leído nuestra{' '}
          <Link to="/privacy" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Política de Privacidad</Link>.
        </p>
        <button
          onClick={handleAccept}
          disabled={loading}
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Guardando...' : 'Aceptar'}
        </button>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <PageTransition>
        <Routes>
      {/* Rutas publicas de autenticacion - SIN Layout */}
      {/* Usar path="/sign-in/*" para que Clerk pueda manejar subrutas como /sign-in/sso-callback */}
      <Route
        path="/sign-in/*"
        element={
          <PublicAuthRoute>
            <AuthPage />
          </PublicAuthRoute>
        }
      />
      
      {/* OAuth bridge — Claude Desktop redirige aqui, esta pagina obtiene el
          session_token de Clerk y redirige al backend para completar el authorize */}
      <Route path="/oauth/login" element={<OAuthLogin />} />
      
      {/* Rutas protegidas con Layout */}
      <Route path="/" element={
        <NotificationsProvider>
          <NotificationBadgeProvider>
            <Layout />
          </NotificationBadgeProvider>
        </NotificationsProvider>
      }>
        <Route index element={<Home />} />
        
        {/* Client routes */}
        <Route path="create-ride" element={
          <ProtectedRoute>
            <CreateRide />
          </ProtectedRoute>
        } />
        <Route path="my-rides" element={
          <ProtectedRoute>
            <MyRides />
          </ProtectedRoute>
        } />
        <Route path="ride/:id" element={
          <ProtectedRoute>
            <RideDetails />
          </ProtectedRoute>
        } />
        <Route path="chat/:rideId" element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        } />
        
        {/* Driver routes */}
        <Route path="driver" element={
          <ProtectedRoute>
            <DriverDashboard />
          </ProtectedRoute>
        } />
        <Route path="driver/profile" element={
          <ProtectedRoute>
            <DriverProfile />
          </ProtectedRoute>
        } />
        <Route path="driver/payments/history" element={
          <ProtectedRoute>
            <PaymentHistory />
          </ProtectedRoute>
        } />
        <Route path="register-driver" element={
          <ProtectedRoute>
            <RegisterDriver />
          </ProtectedRoute>
        } />
        
        {/* Profile routes */}
        <Route path="profile/:clerkId" element={
          <ProtectedRoute>
            <DriverPublicProfile />
          </ProtectedRoute>
        } />
        
        {/* Payment routes */}
        <Route path="add-payment-method" element={
          <ProtectedRoute>
            <AddPaymentMethodPage />
          </ProtectedRoute>
        } />
        
        {/* Settings routes */}
        <Route path="settings/mcp" element={
          <ProtectedRoute>
            <SettingsMcp />
          </ProtectedRoute>
        } />
        
        {/* Notifications */}
        <Route path="notifications" element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        } />

        {/* Privacy / GDPR */}
        <Route path="privacy" element={<Privacy />} />
        <Route path="settings/gdpr" element={
          <ProtectedRoute>
            <GdprSettings />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
      </PageTransition>
      <ConsentBanner />
      <ToastContainer />
    </ErrorBoundary>
  )
}

export default App