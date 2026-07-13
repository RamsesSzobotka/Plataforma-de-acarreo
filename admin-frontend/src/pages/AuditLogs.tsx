import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface AuditLog {
  _id: string
  action: string
  userId: string
  userEmail?: string
  userName?: string
  entityType: string
  entityId: string
  details: Record<string, any>
  metadata?: {
    ip?: string
    userAgent?: string
  }
  createdAt: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Temp filter state (applied on click)
  const [actionDraft, setActionDraft] = useState('')
  const [userIdDraft, setUserIdDraft] = useState('')
  const [entityTypeDraft, setEntityTypeDraft] = useState('')
  const [fromDraft, setFromDraft] = useState('')
  const [toDraft, setToDraft] = useState('')

  // Expanded row
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    loadLogs()
  }, [page, limit])

  async function loadLogs() {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (actionFilter) params.action = actionFilter
      if (userIdFilter) params.userId = userIdFilter
      if (entityTypeFilter) params.entityType = entityTypeFilter
      if (fromDate) params.from = fromDate
      if (toDate) params.to = toDate
      const res = await api.getAuditLogs(params)
      setLogs(res.data || [])
      setTotal(res.pagination?.total || 0)
      setTotalPages(res.pagination?.pages || 0)
    } catch (err) {
      console.error('Error loading audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    setActionFilter(actionDraft)
    setUserIdFilter(userIdDraft)
    setEntityTypeFilter(entityTypeDraft)
    setFromDate(fromDraft)
    setToDate(toDraft)
    setPage(1)
  }

  function clearFilters() {
    setActionDraft('')
    setUserIdDraft('')
    setEntityTypeDraft('')
    setFromDraft('')
    setToDraft('')
    setActionFilter('')
    setUserIdFilter('')
    setEntityTypeFilter('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  function toggleRow(id: string) {
    setExpandedRow(expandedRow === id ? null : id)
  }

  const hasActiveFilters = actionFilter || userIdFilter || entityTypeFilter || fromDate || toDate

  if (loading && logs.length === 0) {
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
              history
            </span>
            Auditoría
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Registro de actividades del sistema
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="data-table-wrap">
        <div className="table-header">
          <h3>Filtros</h3>
          <div className="table-filters" style={{ flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Desde:
              <input
                type="date"
                value={fromDraft}
                onChange={(e) => setFromDraft(e.target.value)}
                style={{ padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Hasta:
              <input
                type="date"
                value={toDraft}
                onChange={(e) => setToDraft(e.target.value)}
                style={{ padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}
              />
            </label>
            <input
              type="text"
              placeholder="Acción..."
              value={actionDraft}
              onChange={(e) => setActionDraft(e.target.value)}
              style={{ width: '140px' }}
            />
            <input
              type="text"
              placeholder="Usuario ID..."
              value={userIdDraft}
              onChange={(e) => setUserIdDraft(e.target.value)}
              style={{ width: '140px' }}
            />
            <input
              type="text"
              placeholder="Tipo entidad..."
              value={entityTypeDraft}
              onChange={(e) => setEntityTypeDraft(e.target.value)}
              style={{ width: '140px' }}
            />
            <button className="action-btn primary" onClick={applyFilters}>
              Aplicar filtros
            </button>
            {hasActiveFilters && (
              <button className="action-btn secondary" onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-rounded">history</span>
            <p>No hay registros de auditoría{hasActiveFilters ? ' con los filtros seleccionados' : ''}</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Tipo Entidad</th>
                  <th>ID Entidad</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log._id}
                      onClick={() => toggleRow(log._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                        {formatDate(log.createdAt)}
                      </td>
                      <td>
                        {log.userName || log.userEmail || (
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            {log.userId.slice(0, 12)}
                          </code>
                        )}
                      </td>
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                          {log.action}
                        </code>
                      </td>
                      <td>{log.entityType}</td>
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                          {log.entityId.slice(0, 12)}
                        </code>
                      </td>
                    </tr>
                    {expandedRow === log._id && (
                      <tr key={`${log._id}-detail`}>
                        <td colSpan={5} style={{ padding: '0', background: 'var(--bg-tertiary)' }}>
                          <div style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                Detalles
                              </h4>
                              <pre style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '0.75rem',
                                fontSize: '0.75rem',
                                lineHeight: '1.5',
                                overflowX: 'auto',
                                maxHeight: '300px',
                                fontFamily: 'var(--font-mono)',
                                margin: 0,
                              }}>
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                            {log.metadata && (log.metadata.ip || log.metadata.userAgent) && (
                              <div>
                                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                  Metadatos
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem' }}>
                                  {log.metadata.ip && (
                                    <div>
                                      <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>IP:</span>
                                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{log.metadata.ip}</code>
                                    </div>
                                  )}
                                  {log.metadata.userAgent && (
                                    <div>
                                      <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>User-Agent:</span>
                                      <span style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{log.metadata.userAgent}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="pagination-info">
                  Página {page} de {totalPages || 1} ({total} registros)
                </span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
                  style={{
                    padding: '0.375rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontSize: '0.8125rem',
                    background: 'var(--bg-primary)',
                  }}
                >
                  <option value={20}>20 / página</option>
                  <option value={50}>50 / página</option>
                </select>
              </div>
              <div className="pagination-buttons">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                {totalPages > 0 &&
                  Array.from(
                    { length: Math.min(5, totalPages) },
                    (_, i) => i + 1
                  ).map((p) => (
                    <button
                      key={p}
                      className={page === p ? 'active' : ''}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
