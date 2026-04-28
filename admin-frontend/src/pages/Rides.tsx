import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

interface Ride {
  _id: string
  title: string
  description: string
  type: string
  status: string
  estimatedPrice: number
  finalPrice?: number
  clientId?: { firstName?: string; lastName?: string; email: string }
  driverId?: { firstName?: string; lastName?: string }
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  createdAt: string
}

export default function Rides() {
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getRides({ status: statusFilter || 'todos', page })
      .then((res) => {
        setRides(res.data)
        setPagination(res.pagination)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  async function handleCancel(id: string) {
    const reason = prompt('Motivo de cancelación:')
    if (!reason) return
    setActionLoading(id)
    try {
      await api.cancelRide(id, reason)
      setRides((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: 'cancelled' } : r))
      )
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este pedido?')) return
    setActionLoading(id)
    try {
      await api.deleteRide(id)
      setRides((prev) => prev.filter((r) => r._id !== id))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      requested: 'Solicitado',
      negotiating: 'Negociando',
      accepted: 'Aceptado',
      in_progress: 'En progreso',
      completed: 'Completado',
      paid: 'Pagado',
      cancelled: 'Cancelado',
    }
    return labels[status] || status
  }

  function getTypeLabel(type: string) {
    const labels: Record<string, string> = {
      mudanza: 'Mudanza',
      electrodomesticos: 'Electrodomésticos',
      muebles: 'Muebles',
      productos: 'Productos',
      otros: 'Otros',
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>Pedidos</h2>
      </div>
      <div className="data-table-wrap">
        <div className="table-header">
          <h3>Todos los pedidos</h3>
          <div className="table-filters">
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="todos">Todos</option>
              <option value="requested">Solicitados</option>
              <option value="negotiating">Negociando</option>
              <option value="accepted">Aceptados</option>
              <option value="in_progress">En progreso</option>
              <option value="completed">Completados</option>
              <option value="paid">Pagados</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Conductor</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rides.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay pedidos
                </td>
              </tr>
            ) : (
              rides.map((ride) => (
                <tr key={ride._id}>
                  <td>
                    <div>
                      <strong>{ride.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {ride.pickupLocation.address} → {ride.dropoffLocation.address}
                      </div>
                    </div>
                  </td>
                  <td>{getTypeLabel(ride.type)}</td>
                  <td>
                    {ride.clientId ? (
                      <div className="user-cell">
                        <div className="user-avatar">
                          {ride.clientId.firstName?.[0] || '?'}
                        </div>
                        <div className="user-info">
                          <span className="name">
                            {ride.clientId.firstName || ride.clientId.lastName
                              ? `${ride.clientId.firstName || ''} ${ride.clientId.lastName || ''}`.trim()
                              : 'Sin nombre'}
                          </span>
                          <span className="email">{ride.clientId.email}</span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {ride.driverId ? (
                      <span>
                        {ride.driverId.firstName} {ride.driverId.lastName || ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      ${ride.finalPrice || ride.estimatedPrice}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${ride.status}`}>
                      {getStatusLabel(ride.status)}
                    </span>
                  </td>
                  <td>
                    {new Date(ride.createdAt).toLocaleDateString('es-ES', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td>
                    <div className="btn-group">
                      <Link to={`/rides/${ride._id}`} className="action-btn secondary">
                        Ver
                      </Link>
                      {ride.status !== 'cancelled' &&
                        ride.status !== 'completed' &&
                        ride.status !== 'paid' && (
                          <>
                            <button
                              className="action-btn danger"
                              onClick={() => handleCancel(ride._id)}
                              disabled={actionLoading === ride._id}
                            >
                              Cancelar
                            </button>
                            <button
                              className="action-btn danger"
                              onClick={() => handleDelete(ride._id)}
                              disabled={actionLoading === ride._id}
                              style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">
            Página {pagination.page} de {pagination.pages} ({pagination.total} pedidos)
          </span>
          <div className="pagination-buttons">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            {pagination.pages > 0 &&
              Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={pagination.page === p ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
            <button
              disabled={pagination.page === pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}