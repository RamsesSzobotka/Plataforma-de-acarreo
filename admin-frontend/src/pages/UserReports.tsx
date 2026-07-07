import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import Swal from 'sweetalert2'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  resolved: 'Resuelto',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  in_review: '#3B82F6',
  resolved: '#22C55E',
}

const STATUS_ICONS: Record<string, string> = {
  pending: 'pending',
  in_review: 'rate_review',
  resolved: 'check_circle',
}

export default function UserReports() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadReports()
  }, [statusFilter, page])

  async function loadReports() {
    setLoading(true)
    try {
      const params: any = { page, limit: 20 }
      if (statusFilter !== 'todos') params.status = statusFilter
      const res = await api.getReports(params)
      setReports(res.data || [])
      setPagination(res.pagination)
    } catch (err) {
      console.error('Error loading reports:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeStatus(reportId: string, newStatus: string) {
    const result = await Swal.fire({
      title: 'Cambiar estado',
      text: `¿Cambiar estado a "${STATUS_LABELS[newStatus]}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0D9488',
      cancelButtonColor: '#64748B',
      reverseButtons: true,
    })

    if (!result.isConfirmed) return

    setActionLoading(reportId)
    try {
      await api.updateReportStatus(reportId, newStatus)
      setReports(prev =>
        prev.map(r =>
          r._id === reportId ? { ...r, status: newStatus } : r
        )
      )
      await Swal.fire({
        icon: 'success',
        title: 'Estado actualizado',
        text: `Reporte marcado como "${STATUS_LABELS[newStatus]}"`,
        confirmButtonColor: '#0D9488',
        timer: 2000,
        timerProgressBar: true,
      })
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Error al actualizar estado',
        confirmButtonColor: '#0D9488',
      })
    } finally {
      setActionLoading(null)
    }
  }

  function getNextStatus(current: string): string | null {
    if (current === 'pending') return 'in_review'
    if (current === 'in_review') return 'resolved'
    return null
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('es-PA', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const startItem = (pagination.page - 1) * pagination.limit + 1
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total)
  const maxVisiblePages = 5

  function getPageNumbers(): number[] {
    const pages: number[] = []
    const total = pagination.pages
    const current = pagination.page
    let start = Math.max(1, current - Math.floor(maxVisiblePages / 2))
    let end = Math.min(total, start + maxVisiblePages - 1)
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1)
    }
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
            <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: '#0D9488' }}>flag</span>
            Reportes de Usuarios
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748B', fontSize: '0.875rem' }}>
            {pagination.total > 0
              ? `Mostrando ${startItem}-${endItem} de ${pagination.total} reportes`
              : 'Sin reportes'}
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            fontSize: '0.875rem',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          <option value="todos">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="in_review">En revisión</option>
          <option value="resolved">Resuelto</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#64748B',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '48px', color: '#CBD5E1' }}>flag</span>
          <p style={{ marginTop: '1rem' }}>No hay reportes{statusFilter !== 'todos' ? ` en estado "${STATUS_LABELS[statusFilter]}"` : ''}</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <th style={thStyle}>Reportante</th>
                <th style={thStyle}>Reportado</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Comentario</th>
                <th style={thStyle}>Publicación</th>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {report.reporter?.imageUrl ? (
                        <img src={report.reporter.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#94A3B8' }}>person</span>
                        </div>
                      )}
                      <span style={{ fontSize: '0.875rem' }}>
                        {report.reporter?.firstName || ''} {report.reporter?.lastName || ''}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {report.reported?.imageUrl ? (
                        <img src={report.reported.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#94A3B8' }}>person</span>
                        </div>
                      )}
                      <span style={{ fontSize: '0.875rem' }}>
                        {report.reported?.firstName || ''} {report.reported?.lastName || ''}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: report.reportedRole === 'driver' ? '#FFF7ED' : '#F0FDF4',
                      color: report.reportedRole === 'driver' ? '#F97316' : '#22C55E',
                    }}>
                      {report.reportedRole === 'driver' ? 'Conductor' : 'Cliente'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '250px' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {report.comment}
                    </p>
                  </td>
                  <td style={tdStyle}>
                    {report.rideId ? (
                      <Link to={`/rides/${report.rideId}`} style={{ fontSize: '0.875rem', color: '#0D9488', textDecoration: 'none' }}>
                        Ver acarreo
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.875rem', color: '#94A3B8' }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{formatDate(report.createdAt)}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: `${STATUS_COLORS[report.status]}15`,
                      color: STATUS_COLORS[report.status],
                    }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                        {STATUS_ICONS[report.status]}
                      </span>
                      {STATUS_LABELS[report.status]}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {report.status !== 'resolved' ? (
                      <button
                        onClick={() => {
                          const next = getNextStatus(report.status)
                          if (next) handleChangeStatus(report._id, next)
                        }}
                        disabled={actionLoading === report._id}
                        style={{
                          padding: '4px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          background: 'white',
                          cursor: actionLoading === report._id ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          color: '#0D9488',
                          opacity: actionLoading === report._id ? 0.6 : 1,
                        }}
                      >
                        {actionLoading === report._id ? '...' : report.status === 'pending' ? 'Revisar' : 'Resolver'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              borderTop: '1px solid #E2E8F0',
              fontSize: '0.875rem',
              color: '#64748B',
            }}>
              <span>Página {pagination.page} de {pagination.pages} ({pagination.total} items)</span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  style={pageBtnStyle(pagination.page <= 1)}
                >
                  Anterior
                </button>
                {getPageNumbers().map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      ...pageBtnStyle(false),
                      background: p === pagination.page ? '#0D9488' : 'transparent',
                      color: p === pagination.page ? 'white' : '#64748B',
                      fontWeight: p === pagination.page ? 600 : 400,
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page >= pagination.pages}
                  style={pageBtnStyle(pagination.page >= pagination.pages)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  verticalAlign: 'middle',
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.875rem',
    color: disabled ? '#CBD5E1' : '#64748B',
    opacity: disabled ? 0.6 : 1,
  }
}
