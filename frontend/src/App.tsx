import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import Layout from './components/Layout'
import Home from './pages/Home'
import AuthPage from './pages/AuthPage'
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
import { NotificationsProvider } from './contexts/NotificationsContext'
import ErrorBoundary from './components/ErrorBoundary'
import PageTransition from './components/PageTransition'
import { hideLoading, showLoading } from './services/alerts'
import ToastContainer from './components/Toast'

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

function App() {
  return (
    <ErrorBoundary>
      <PageTransition>
        <Routes>
      {/* Ruta publica de autenticacion - SIN Layout */}
      <Route
        path="/sign-in"
        element={
          <PublicAuthRoute>
            <AuthPage />
          </PublicAuthRoute>
        }
      />
      
      {/* Rutas protegidas con Layout */}
      <Route path="/" element={
        <NotificationsProvider>
          <Layout />
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
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
      </PageTransition>
      <ToastContainer />
    </ErrorBoundary>
  )
}

export default App