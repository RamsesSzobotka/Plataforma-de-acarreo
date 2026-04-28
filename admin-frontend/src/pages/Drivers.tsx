import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

interface Driver {
  userId: string
  verificationStatus: string
  vehicleType: string
  plate: string
  rating: number
  totalRides: number
  isAvailable: boolean
  user?: {
    firstName?: string
    lastName?: string
    email: string
    imageUrl?: string
  }
  createdAt: string
}

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getDrivers({ status: statusFilter || 'todos', page })
      .then((res) => {
        setDrivers(res.data)
        setPagination(res.pagination)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  async function handleApprove(userId: string) {
    if (!confirm('¿Aprobar este conductor?')) return
    setActionLoading(userId)
    try {
      await api.approveDriver(userId)
      setDrivers((prev) =>
        prev.map((d) =>
          d.userId === userId ? { ...d, verificationStatus: 'verified' } : d
        )
      )
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(userId: string) {
    const reason = prompt('Motivo del rechazo:')
    if (!reason) return
    setActionLoading(userId)
    try {
      await api.rejectDriver(userId, reason)
      setDrivers((prev) =>
        prev.map((d) =>
          d.userId === userId
            ? { ...d, verificationStatus: 'rejected', rejectionReason: reason }
            : d
        )
      )
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReview(userId: string) {
    setActionLoading(userId)
    try {
      await api.reviewDriver(userId)
      setDrivers((prev) =>
        prev.map((d) =>
          d.userId === userId ? { ...d, verificationStatus: 'in_review' } : d
        )
      )
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  function getInitials(firstName?: string, lastName?: string) {
    if (firstName) return firstName[0].toUpperCase()
    if (lastName) return lastName[0].toUpperCase()
    return '?'
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
        <h2>Conductores</h2>
      </div>
      <div className="data-table-wrap">
        <div className="table-header">
          <h3>Todos los conductores</h3>
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
              <option value="pending">Pendientes</option>
              <option value="in_review">En revisión</option>
              <option value="verified">Verificados</option>
              <option value="rejected">Rechazados</option>
              <option value="suspended">Suspendidos</option>
            </select>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Conductor</th>
              <th>Vehículo</th>
              <th>Estado</th>
              <th>Rating</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay conductores
                </td>
              </tr>
            ) : (
              drivers.map((driver) => (
                <tr key={driver.userId}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {getInitials(driver.user?.firstName, driver.user?.lastName)}
                      </div>
                      <div className="user-info">
                        <span className="name">
                          {driver.user?.firstName || driver.user?.lastName
                            ? `${driver.user?.firstName || ''} ${
                                driver.user?.lastName || ''
                              }`.trim()
                            : 'Sin nombre'}
                        </span>
                        <span className="email">{driver.user?.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{driver.vehicleType}</strong>
                      <br />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {driver.plate}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${driver.verificationStatus}`}>
                      {driver.verificationStatus === 'pending'
                        ? 'Pendiente'
                        : driver.verificationStatus === 'in_review'
                          ? 'En revisión'
                          : driver.verificationStatus === 'verified'
                            ? 'Verificado'
                            : driver.verificationStatus === 'rejected'
                              ? 'Rechazado'
                              : 'Suspendido'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ color: '#F59E0B' }}>★</span>
                      <span style={{ fontWeight: 600 }}>
                        {driver.rating?.toFixed(1) || '0.0'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        ({driver.totalRides || 0})
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="btn-group">
                      <Link
                        to={`/drivers/${driver.userId}`}
                        className="action-btn secondary"
                      >
                        Ver
                      </Link>
                      {(driver.verificationStatus === 'pending' ||
                        driver.verificationStatus === 'in_review') && (
                        <>
                          <button
                            className="action-btn success"
                            onClick={() => handleApprove(driver.userId)}
                            disabled={actionLoading === driver.userId}
                          >
                            Aprobar
                          </button>
                          <button
                            className="action-btn danger"
                            onClick={() => handleReject(driver.userId)}
                            disabled={actionLoading === driver.userId}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {driver.verificationStatus === 'pending' && (
                        <button
                          className="action-btn secondary"
                          onClick={() => handleReview(driver.userId)}
                          disabled={actionLoading === driver.userId}
                        >
                          Revisar
                        </button>
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
            Página {pagination.page} de {pagination.pages} (
            {pagination.total} conductores
            {pagination.total === 1 ? '' : 's'})
          </span>
          <div className="pagination-buttons">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            {pagination.pages > 0 &&
              Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => i + 1).map(
                (p) => (
                  <button
                    key={p}
                    className={pagination.page === p ? 'active' : ''}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
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