import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import Layout from './components/Layout'
import Home from './pages/Home'
import CreateRide from './pages/CreateRide'
import MyRides from './pages/MyRides'
import RideDetails from './pages/RideDetails'
import DriverDashboard from './pages/DriverDashboard'
import Chat from './pages/Chat'

// Protected route wrapper
function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: string }) {
  const { isSignedIn, user } = useAuth()
  
  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }
  
  // TODO: Check user role from metadata
  // if (allowedRole && userRole !== allowedRole) {
  //   return <Navigate to="/" replace />
  // }
  
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        
        {/* Client routes */}
        <Route path="create-ride" element={
          <ProtectedRoute allowedRole="client">
            <CreateRide />
          </ProtectedRoute>
        } />
        <Route path="my-rides" element={
          <ProtectedRoute allowedRole="client">
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
          <ProtectedRoute allowedRole="driver">
            <DriverDashboard />
          </ProtectedRoute>
        } />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App