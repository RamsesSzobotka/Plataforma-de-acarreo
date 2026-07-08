import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../services/api'

interface Report {
  _id: string
  category: string
  comment: string
  reporter: {
    clerkId: string
    firstName?: string
    lastName?: string
    email: string
    imageUrl?: string
  }
  reported: {
    clerkId: string
    firstName?: string
    lastName?: string
    email: string
    imageUrl?: string
    role?: string
  }
  rideId?: string
  paymentStatus: string
  status: string
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  resolved: 'Resuelto',
}

const CATEGORY_LABELS: Record<string, string> = {
  payment_dispute: 'Disputa de pago',
  illicit_actions: 'Acciones ilícitas',
  other: 'Otro',
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  payment_dispute: { bg: 'rgba(239, 68, 68, 0.1)', color: '#DC2626' },
  illicit_actions: { bg: 'rgba(249, 115, 22, 0.1)', color: '#EA580C' },
  other: { bg: 'rgba(100, 116, 139, 0.1)', color: '#475569' },
}

const PAYMENT_LABELS: Record<string, string> = {
  charged: 'Cobrado',
  transferred: 'Transferido',
  refunded: 'Reembolsado',
  none: 'Sin pago',
}

const PAYMENT_COLORS: Record<string, { bg: string; color: string }> = {
  charged: { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563EB' },
  transferred: { bg: 'rgba(34, 197, 94, 0.1)', color: '#16A34A' },
  refunded: { bg: 'rgba(239, 68, 68, 0.1)', color: '#DC2626' },
  none: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748B' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(firstName?: string, lastName?: string) {
  if (firstName) return firstName[0].toUpperCase()
  if (lastName) return lastName[0].toUpperCase()
  return '?'
}

function UserDisplay({ user }: { user?: Report['reporter'] | Report['reported'] }) {
  if (!user) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <div className="user-cell">
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt="Avatar"
          className="user-avatar"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div className="user-avatar">
          {getInitials(user.firstName, user.lastName)}
        </div>
      )}
      <div className="user-info">
        <span className="name">
          {user.firstName || user.lastName
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
            : 'Sin nombre'}
        </span>
        <span className="email">{user.email}</span>
      </div>
    </div>
  )
}

export default function Disputes() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [categoryFilter, setCategoryFilter] = useState('todos')
  const [searchText, setSearchText] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Detail modal
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    loadReports()
  }, [page, statusFilter, categoryFilter])

  async function loadReports() {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (statusFilter !== 'todos') params.status = statusFilter
      if (categoryFilter !== 'todos') params.category = categoryFilter
      const res = await api.getReports(params)
      setReports(res.data || [])
      setPagination(res.pagination)
    } catch (err) {
      console.error('Error loading reports:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    if (!searchText.trim()) return
    setPage(1)
    setLoading(true)
    api
      .getReports({ page: 1, limit: 20, search: searchText.trim() })
      .then((res) => {
        setReports(res.data || [])
        setPagination(res.pagination)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  function clearSearch() {
    setSearchText('')
    if (searchText.trim()) {
      setPage(1)
      loadReports()
    }
  }

  async function openDetail(reportId: string) {
    setModalLoading(true)
    setShowModal(true)
    try {
      const report = await api.getReport(reportId)
      setSelectedReport(report)
    } catch (err: any) {
      alert(err.message || 'Error al cargar detalle del reporte')
      setShowModal(false)
    } finally {
      setModalLoading(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    setSelectedReport(null)
  }

  async function handleRefundAndCancel() {
    if (!selectedReport?.rideId) return
    const reason = prompt('Motivo del reembolso y cancelación:')
    if (!reason) return
    setActionLoading('refund')
    try {
      await api.refundRide(selectedReport.rideId, {
        reportId: selectedReport._id,
        reason,
      })
      closeModal()
      loadReports()
    } catch (e: any) {
      alert(e.message || 'Error al procesar reembolso')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSuspendDriver() {
    if (!selectedReport) return
    if (!confirm('¿Suspender al conductor denunciado?')) return
    setActionLoading('suspend')
    try {
      await api.resolveReport(selectedReport._id, { resolution: 'suspended' })
      closeModal()
      loadReports()
    } catch (e: any) {
      alert(e.message || 'Error al suspender conductor')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDismiss() {
    if (!selectedReport) return
    if (!confirm('¿Resolver sin tomar acción?')) return
    setActionLoading('dismiss')
    try {
      await api.resolveReport(selectedReport._id, { resolution: 'dismissed' })
      closeModal()
      loadReports()
    } catch (e: any) {
      alert(e.message || 'Error al resolver reporte')
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePayDriver() {
    if (!selectedReport?.rideId) return

    const result = await Swal.fire({
      title: '¿Pagar al conductor?',
      text: 'Se liberará el pago capturado al conductor por el acarreo. ¿Estás seguro?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, pagar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#22C55E',
      cancelButtonColor: '#64748B',
      reverseButtons: true,
    })

    if (!result.isConfirmed) return

    setActionLoading('pay')
    try {
      await api.payDriverRide(selectedReport.rideId, {
        reportId: selectedReport._id,
      })
      await Swal.fire({
        icon: 'success',
        title: 'Pago procesado',
        text: 'El pago al conductor ha sido liberado correctamente.',
        confirmButtonColor: '#0D9488',
      })
      closeModal()
      loadReports()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const canAct = selectedReport && (selectedReport.status === 'pending' || selectedReport.status === 'in_review')

  if (loading && reports.length === 0) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>
            <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}>
              flag
            </span>
            Disputas
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Reportes de Usuarios
          </p>
        </div>
      </div>

      <div className="data-table-wrap">
        <div className="table-header">
          <h3>Todos los reportes</h3>
          <div className="table-filters">
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="todos">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="in_review">En revisión</option>
              <option value="resolved">Resuelto</option>
            </select>
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="todos">Todas las categorías</option>
              <option value="payment_dispute">Disputa de pago</option>
              <option value="illicit_actions">Acciones ilícitas</option>
              <option value="other">Otro</option>
            </select>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchText && (
              <button
                className="action-btn secondary"
                onClick={clearSearch}
                style={{ padding: '0.5rem' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  close
                </span>
              </button>
            )}
            {searchText && (
              <button className="action-btn primary" onClick={handleSearch}>
                Buscar
              </button>
            )}
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-rounded">flag</span>
            <p>No hay reportes{statusFilter !== 'todos' ? ' con el filtro seleccionado' : ''}</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Categoría</th>
                  <th>Denunciante</th>
                  <th>Denunciado</th>
                  <th>Ride ID</th>
                  <th>Estado Pago</th>
                  <th>Estado Reporte</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const catColor = CATEGORY_COLORS[report.category] || CATEGORY_COLORS.other
                  const payColor = PAYMENT_COLORS[report.paymentStatus] || PAYMENT_COLORS.none
                  return (
                    <tr key={report._id}>
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                          {report._id.slice(0, 8)}
                        </code>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            background: catColor.bg,
                            color: catColor.color,
                          }}
                        >
                          {CATEGORY_LABELS[report.category] || report.category}
                        </span>
                      </td>
                      <td>
                        <UserDisplay user={report.reporter} />
                      </td>
                      <td>
                        <UserDisplay user={report.reported} />
                      </td>
                      <td>
                        {report.rideId ? (
                          <Link
                            to={`/rides/${report.rideId}`}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                          >
                            {report.rideId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: payColor.color,
                          }}
                        >
                          {PAYMENT_LABELS[report.paymentStatus] || report.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${report.status}`}>
                          {STATUS_LABELS[report.status] || report.status}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group">
                          <button
                            className="action-btn secondary"
                            onClick={() => openDetail(report._id)}
                          >
                            Ver detalle
                          </button>
                          {(report.status === 'pending' || report.status === 'in_review') && (
                            <button
                              className="action-btn primary"
                              onClick={() => openDetail(report._id)}
                            >
                              Resolver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="pagination">
              <span className="pagination-info">
                Página {pagination.page} de {pagination.pages} (
                {pagination.total} reportes
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
                  Array.from(
                    { length: Math.min(5, pagination.pages) },
                    (_, i) => i + 1
                  ).map((p) => (
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
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            style={{ maxWidth: '550px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Detalle del Reporte</h3>
              <button className="modal-close" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            {modalLoading ? (
              <div className="loading-spinner">
                <div className="spinner" />
              </div>
            ) : selectedReport ? (
              <>
                <div className="modal-body">
                  {/* Report info */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                      Información del Reporte
                    </h4>
                    <div className="detail-row">
                      <span className="detail-label">ID</span>
                      <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        {selectedReport._id}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Categoría</span>
                      <span className="detail-value">
                        <span
                          className="status-badge"
                          style={{
                            background: CATEGORY_COLORS[selectedReport.category]?.bg || CATEGORY_COLORS.other.bg,
                            color: CATEGORY_COLORS[selectedReport.category]?.color || CATEGORY_COLORS.other.color,
                          }}
                        >
                          {CATEGORY_LABELS[selectedReport.category] || selectedReport.category}
                        </span>
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Comentario</span>
                      <span className="detail-value">{selectedReport.comment || '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Fecha</span>
                      <span className="detail-value">{formatDate(selectedReport.createdAt)}</span>
                    </div>
                  </div>

                  {/* Users */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                      Usuarios
                    </h4>
                    <div className="detail-row">
                      <span className="detail-label">Denunciante</span>
                      <span className="detail-value">
                        <UserDisplay user={selectedReport.reporter} />
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Denunciado</span>
                      <span className="detail-value">
                        <UserDisplay user={selectedReport.reported} />
                      </span>
                    </div>
                  </div>

                  {/* Ride section */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                      Acarreo Asociado
                    </h4>
                    {selectedReport.rideId ? (
                      <>
                        <div className="detail-row">
                          <span className="detail-label">Ride ID</span>
                          <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            <Link to={`/rides/${selectedReport.rideId}`}>
                              {selectedReport.rideId}
                            </Link>
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Estado Pago</span>
                          <span
                            className="detail-value"
                            style={{
                              fontWeight: 600,
                              color: PAYMENT_COLORS[selectedReport.paymentStatus]?.color || PAYMENT_COLORS.none.color,
                            }}
                          >
                            {PAYMENT_LABELS[selectedReport.paymentStatus] || selectedReport.paymentStatus}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="detail-row">
                        <span className="detail-label" style={{ color: 'var(--text-muted)' }}>
                          Sin acarreo asociado
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {canAct && (
                  <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
                    {selectedReport.rideId && (
                      <button
                        className="action-btn danger"
                        onClick={handleRefundAndCancel}
                        disabled={actionLoading === 'refund'}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                          refund
                        </span>
                        Reembolsar y cancelar viaje
                      </button>
                    )}
                    {selectedReport.rideId && selectedReport.paymentStatus === 'charged' && (
                      <button
                        className="action-btn success"
                        onClick={handlePayDriver}
                        disabled={actionLoading === 'pay'}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                          payments
                        </span>
                        Pagar al conductor
                      </button>
                    )}
                    <button
                      className="action-btn"
                      style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#B45309',
                      }}
                      onClick={handleSuspendDriver}
                      disabled={actionLoading === 'suspend'}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                        block
                      </span>
                      Suspender conductor
                    </button>
                    <button
                      className="action-btn secondary"
                      onClick={handleDismiss}
                      disabled={actionLoading === 'dismiss'}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                        check
                      </span>
                      Resolver sin acción
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
