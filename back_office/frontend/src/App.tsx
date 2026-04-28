import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Drivers from './pages/Drivers'
import DriverVerification from './pages/DriverVerification'
import Rides from './pages/Rides'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/drivers/pending" element={<DriverVerification />} />
        <Route path="/rides" element={<Rides />} />
      </Routes>
    </Layout>
  )
}