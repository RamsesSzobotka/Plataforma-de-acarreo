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
  createdAt: string
}

function MyRides() {
  const { user } = useUser()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (user) {
      loadRides()
    }
  }, [user, filter])

  async function loadRides() {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const response = await fetch(`/api/rides${params}`)
      const data = await response.json()
      setRides(data.data || [])
    } catch (error) {
      console.error('Error loading rides:', error)
    } finally {
      setLoading(false)
    }
  }

  const statusLabels: Record<string, string> = {
    requested: 'Pendiente',
    negotiating: 'Negociando',
    accepted: 'Aceptado',
    in_progress: 'En Progreso',
    completed: 'Completado',
    paid: 'Pagado',
    cancelled: 'Cancelado',
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

  if (loading) {
    return <div>Cargando...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-rounded">local_shipping</span>
          Mis Pedidos
        </h1>
        <Link to="/create-ride" className="btn btn-primary">
          <span className="material-symbols-rounded">add</span>
          Nuevo Pedido
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['all', 'requested', 'negotiating', 'accepted', 'in_progress', 'completed'].map((s) => (
          <button
            key={s}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'Todos' : statusLabels[s] || s}
          </button>
        ))}
      </div>

      {/* Rides list */}
      {rides.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#64748B', marginBottom: '1rem', display: 'block' }}>
            inventory_2
          </span>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No tienes pedidos
          </p>
          <Link to="/create-ride" className="btn btn-primary">
            Crear tu primer pedido
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rides.map((ride) => (
            <Link
              key={ride._id}
              to={`/ride/${ride._id}`}
              className="card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>local_shipping</span>
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
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      background: statusColors[ride.status] || '#64748b',
                      color: 'white',
                    }}
                  >
                    {statusLabels[ride.status] || ride.status}
                  </span>
                  <p style={{ marginTop: '0.5rem', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                    ${ride.estimatedPrice}
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

export default MyRides