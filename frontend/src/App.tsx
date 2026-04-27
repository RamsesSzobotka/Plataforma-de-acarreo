import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import Layout from './components/Layout'
import Home from './pages/Home'
import AuthPage from './pages/AuthPage'
import CreateRide from './pages/CreateRide'
import MyRides from './pages/MyRides'
import RideDetails from './pages/RideDetails'
import DriverDashboard from './pages/DriverDashboard'
import Chat from './pages/Chat'
import RegisterDriver from './pages/RegisterDriver'

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth()
  
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Ruta publica de autenticacion - SIN Layout */}
      <Route path="/sign-in" element={<AuthPage />} />
      
      {/* Rutas protegidas con Layout */}
      <Route path="/" element={<Layout />}>
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
        <Route path="register-driver" element={
          <ProtectedRoute>
            <RegisterDriver />
          </ProtectedRoute>
        } />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App