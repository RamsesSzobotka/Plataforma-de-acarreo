import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { ridesAPI } from '../services/api'
import type { PaginatedResponse } from '../types'

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

const PAGE_LIMIT = 10

function MyRides() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    setPage(1) // Reset page when filter changes
  }, [filter])

  useEffect(() => {
    if (user) {
      loadRides()
    }
  }, [user, filter, page])

  async function loadRides() {
    try {
      setLoading(true)
      const token = await getToken()
      const data: PaginatedResponse<Ride> = await ridesAPI.list(
        {
          clientId: user?.id,
          status: filter !== 'all' ? filter : undefined,
          page,
          limit: PAGE_LIMIT,
        },
        token || undefined
      )
      setRides(data.data || [])
      if (data.pagination) {
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error loading rides:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const startRange = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1
  const endRange = Math.min(page * PAGE_LIMIT, total)

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

      {/* Pagination Info */}
      {total > 0 && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Mostrando {startRange}-{endRange} de {total} pedidos
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>chevron_left</span>
            Anterior
          </button>

          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              // Show first, last, current, and neighbors
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= page - 1 && pageNum <= page + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    className={`btn ${pageNum === page ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handlePageChange(pageNum)}
                    style={{ minWidth: '2.5rem', padding: '0.5rem' }}
                  >
                    {pageNum}
                  </button>
                )
              }
              // Show ellipsis
              if (pageNum === page - 2 || pageNum === page + 2) {
                return <span key={pageNum} style={{ color: 'var(--text-muted)' }}>...</span>
              }
              return null
            })}
          </div>

          <button
            className="btn btn-outline"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            Siguiente
            <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>chevron_right</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default MyRides