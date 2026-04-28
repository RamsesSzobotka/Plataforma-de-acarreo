import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Drivers from './pages/Drivers'
import DriverDetail from './pages/DriverDetail'
import Rides from './pages/Rides'
import RideDetail from './pages/RideDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:userId" element={<DriverDetail />} />
          <Route path="rides" element={<Rides />} />
          <Route path="rides/:id" element={<RideDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}