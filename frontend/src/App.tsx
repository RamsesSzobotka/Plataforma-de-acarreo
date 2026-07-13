import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
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
import TermsAndConditions from './pages/TermsAndConditions'
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

function ConsentOverlay() {
  const { isSignedIn, getToken } = useAuth()
  const { t, i18n } = useTranslation()
  const [consented, setConsented] = useState(() => localStorage.getItem('gdpr_consent') === 'true')
  const [loading, setLoading] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)

  if (consented || !isSignedIn) return null

  const allChecked = privacyChecked && termsChecked

  const handleAccept = async () => {
    if (!allChecked) return
    setLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/gdpr/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version: '2.0', documents: ['privacy', 'terms'] }),
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
      inset: 0,
      background: '#0F172A',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius)',
        padding: '2.5rem',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Language switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => i18n.changeLanguage('es')}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: i18n.language?.startsWith('es') ? 'var(--primary)' : 'transparent',
              color: i18n.language?.startsWith('es') ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            ES
          </button>
          <button
            onClick={() => i18n.changeLanguage('en')}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: i18n.language?.startsWith('en') ? 'var(--primary)' : 'transparent',
              color: i18n.language?.startsWith('en') ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            EN
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: 'var(--primary)' }}>verified_user</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1.5rem' }}>
            {t('consent.title')}
          </h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {t('consent.description')}
        </p>

        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)',
          marginBottom: '0.75rem',
          cursor: 'pointer',
          border: privacyChecked ? '2px solid var(--primary)' : '2px solid transparent',
          transition: 'border-color 0.2s',
        }}>
          <input
            type="checkbox"
            checked={privacyChecked}
            onChange={(e) => setPrivacyChecked(e.target.checked)}
            style={{ marginTop: '3px', accentColor: 'var(--primary)', width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('consent.privacy')}</span>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('consent.privacyText', { link: '' })}
              {' '}
              <Link to="/privacy" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>
                {t('consent.privacy')}
              </Link>
            </p>
          </div>
        </label>

        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)',
          marginBottom: '1.5rem',
          cursor: 'pointer',
          border: termsChecked ? '2px solid var(--primary)' : '2px solid transparent',
          transition: 'border-color 0.2s',
        }}>
          <input
            type="checkbox"
            checked={termsChecked}
            onChange={(e) => setTermsChecked(e.target.checked)}
            style={{ marginTop: '3px', accentColor: 'var(--primary)', width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('consent.terms')}</span>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('consent.termsText', { link: '' })}
              {' '}
              <Link to="/terms" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>
                {t('consent.terms')}
              </Link>
            </p>
          </div>
        </label>

        <button
          onClick={handleAccept}
          disabled={!allChecked || loading}
          style={{
            width: '100%',
            background: allChecked ? 'var(--primary)' : 'var(--border)',
            color: allChecked ? 'white' : 'var(--text-muted)',
            border: 'none',
            padding: '0.85rem',
            borderRadius: 'var(--radius-sm)',
            cursor: allChecked ? 'pointer' : 'not-allowed',
            fontWeight: 700,
            fontSize: '1rem',
            transition: 'all 0.2s',
          }}
        >
          {loading ? t('consent.saving') : t('consent.accept')}
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

        {/* Privacy / Terms / GDPR */}
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<TermsAndConditions />} />
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
      <ConsentOverlay />
      <ToastContainer />
    </ErrorBoundary>
  )
}

export default App