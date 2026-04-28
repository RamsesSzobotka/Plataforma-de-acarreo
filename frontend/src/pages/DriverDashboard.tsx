import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { ridesAPI, usersAPI } from '../services/api'

interface Ride {
  _id: string
  title: string
  type: string
  status: string
  estimatedPrice: number
  finalPrice?: number
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  description: string
}

interface Driver {
  _id: string
  isAvailable: boolean
  rating: number
  totalRides: number
  verificationStatus: string
  vehicleType: string
  plate: string
}

function DriverDashboard() {
  const { user } = useUser()
  const [availableRides, setAvailableRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [driverProfile, setDriverProfile] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [tab, setTab] = useState<'available' | 'mine'>('available')
  const [isAvailable, setIsAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (user) {
      loadDriverProfile()
      loadRides()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadRides()
    }
  }, [tab, user])

  async function loadDriverProfile() {
    try {
      const profile = await usersAPI.getMyDriver()
      setDriverProfile(profile)
      setIsAvailable(profile.isAvailable || false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar perfil'
      setError(message)
      console.error('Error loading driver profile:', err)
    }
  }

  async function loadRides() {
    try {
      if (tab === 'available') {
        const response = await ridesAPI.list({ status: 'requested', limit: 20 })
        setAvailableRides(response.data || [])
      } else {
        const response = await ridesAPI.myRides({ limit: 20 })
        setMyRides(response.data || [])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar pedidos'
      setError(message)
      console.error('Error loading rides:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAcceptRide(rideId: string, price: number) {
    try {
      const updated = await ridesAPI.accept(rideId, price)
      // Update myRides list
      setAvailableRides(availableRides.filter(r => r._id !== rideId))
      setMyRides([updated, ...myRides])
      alert('¡Pedido aceptado exitosamente!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al aceptar el pedido'
      setError(message)
    }
  }

  async function handleToggleAvailability() {
    if (!driverProfile) return
    setUpdating(true)
    setError('')
    try {
      const updated = await usersAPI.updateDriverAvailability(!isAvailable)
      setIsAvailable(!isAvailable)
      setDriverProfile(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar disponibilidad'
      setError(message)
    } finally {
      setUpdating(false)
    }
  }

  const statusColors: Record<string, string> = {
    requested: '#f59e0b',
    negotiating: '#8b5cf6',
    accepted: '#22c55e',
    in_progress: '#3b82f6',
    completed: '#22c55e',
    paid: '#22c55e',
    cancelled: '#ef4444',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-rounded">directions_car</span>
          Panel del Conductor
        </h1>
        <Link to="/driver-profile" className="btn btn-outline">
          <span className="material-symbols-rounded">person</span>
          Mi Perfil
        </Link>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius)',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}

      {/* Driver status card */}
      {driverProfile && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <strong>{driverProfile.vehicleType}</strong> • {driverProfile.plate}
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-rounded" style={{ color: '#F97316' }}>star</span>
                <strong>{driverProfile.rating.toFixed(1)}</strong>
                <span style={{ color: 'var(--text-muted)' }}>({driverProfile.totalRides} viajes)</span>
              </p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Estado: 
                <span style={{
                  marginLeft: '0.5rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  background: driverProfile.verificationStatus === 'verified' ? '#22c55e' : '#f59e0b',
                  color: 'white',
                  fontSize: '0.8rem',
                  display: 'inline-block'
                }}>
                  {driverProfile.verificationStatus}
                </span>
              </p>
            </div>
            <div>
              <button
                className={`btn ${isAvailable ? 'btn-primary' : 'btn-outline'}`}
                onClick={handleToggleAvailability}
                disabled={updating}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span className="material-symbols-rounded">
                  {isAvailable ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                {isAvailable ? 'Disponible' : 'No disponible'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${tab === 'available' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('available')}
        >
          <span className="material-symbols-rounded">search</span>
          Pedidos Disponibles ({availableRides.length})
        </button>
        <button
          className={`btn ${tab === 'mine' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('mine')}
        >
          <span className="material-symbols-rounded">work_history</span>
          Mis Acarreos ({myRides.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>
      ) : tab === 'available' ? (
        availableRides.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#64748B', marginBottom: '1rem', display: 'block' }}>
              search_off
            </span>
            <p style={{ color: 'var(--text-muted)' }}>
              No hay pedidos disponibles
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {availableRides.map((ride) => (
              <div key={ride._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-rounded">local_shipping</span>
                      {ride.title}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>location_on</span>
                      {ride.pickupLocation.address}
                      <span style={{ margin: '0 0.5rem' }}>→</span>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>flag</span>
                      {ride.dropoffLocation.address}
                    </p>
                    <p style={{ fontSize: '0.9rem' }}>{ride.description.substring(0, 100)}...</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      ${ride.estimatedPrice}
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      onClick={() => handleAcceptRide(ride._id, ride.estimatedPrice)}
                    >
                      <span className="material-symbols-rounded">check</span>
                      Aceptar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : myRides.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#64748B', marginBottom: '1rem', display: 'block' }}>
            work_off
          </span>
          <p style={{ color: 'var(--text-muted)' }}>
            No tienes acarreos aceptados
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {myRides.map((ride) => (
            <Link
              key={ride._id}
              to={`/ride/${ride._id}`}
              className="card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="material-symbols-rounded">local_shipping</span>
                    {ride.title}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>location_on</span>
                    {ride.pickupLocation.address}
                    <span style={{ margin: '0 0.5rem' }}>→</span>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>flag</span>
                    {ride.dropoffLocation.address}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '999px',
                    background: statusColors[ride.status] || '#64748b',
                    color: 'white',
                    fontSize: '0.8rem',
                    display: 'inline-block',
                    marginBottom: '0.5rem'
                  }}>
                    {ride.status}
                  </span>
                  <p style={{ fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                    ${ride.finalPrice || ride.estimatedPrice}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default DriverDashboard