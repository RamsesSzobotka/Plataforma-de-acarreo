import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

interface Ride {
  _id: string
  title: string
  type: string
  status: string
  estimatedPrice: number
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  description: string
}

function DriverDashboard() {
  const { user } = useUser()
  const [availableRides, setAvailableRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'available' | 'mine'>('available')

  useEffect(() => {
    loadRides()
  }, [tab])

  async function loadRides() {
    try {
      if (tab === 'available') {
        const response = await fetch('/api/rides?status=requested')
        const data = await response.json()
        setAvailableRides(data.data || [])
      } else {
        const response = await fetch('/api/rides?driverId=' + user?.id)
        const data = await response.json()
        setMyRides(data.data || [])
      }
    } catch (error) {
      console.error('Error loading rides:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAcceptRide(rideId: string, price: number) {
    if (!user) return
    
    try {
      await fetch(`/api/rides/${rideId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: user.id, agreedPrice: price }),
      })
      loadRides()
    } catch (error) {
      console.error('Error accepting ride:', error)
    }
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Panel del Conductor</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${tab === 'available' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('available')}
        >
          Pedidos Cercanos ({availableRides.length})
        </button>
        <button
          className={`btn ${tab === 'mine' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('mine')}
        >
          Mis Acarreos ({myRides.length})
        </button>
      </div>

      {/* Rides list */}
      {tab === 'available' ? (
        availableRides.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
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
                    <h3 style={{ marginBottom: '0.5rem' }}>{ride.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      {ride.pickupLocation.address} → {ride.dropoffLocation.address}
                    </p>
                    <p style={{ fontSize: '0.9rem' }}>{ride.description}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                      ${ride.estimatedPrice}
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => handleAcceptRide(ride._id, ride.estimatedPrice)}
                    >
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
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3>{ride.title}</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {ride.pickupLocation.address} → {ride.dropoffLocation.address}
                  </p>
                </div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  background: 'var(--primary)',
                  color: 'white',
                }}>
                  {ride.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default DriverDashboard