import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Drivers from './pages/Drivers'
import DriverDetail from './pages/DriverDetail'
import Rides from './pages/Rides'
import RideDetail from './pages/RideDetail'
import Reports from './pages/Reports'
import Disputes from './pages/Disputes'
import UserDetail from './pages/UserDetail'
import AuditLogs from './pages/AuditLogs'
import Payments from './pages/Payments'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    setIsAuthenticated(!!token)
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public login route - outside Layout */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes - require admin auth */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:clerkId" element={<UserDetail />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:userId" element={<DriverDetail />} />
          <Route path="rides" element={<Rides />} />
          <Route path="rides/:id" element={<RideDetail />} />
          <Route path="payments" element={<Payments />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>

        {/* Fallback - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}