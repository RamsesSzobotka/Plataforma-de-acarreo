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

interface McpAuditLog {
  _id: string
  clerkId: string
  role?: string
  action: string
  toolName?: string
  resourceType?: string
  resourceId?: string
  success: boolean
  errorCode?: string
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
  durationMs?: number
  createdAt: string
}

type Tab = 'general' | 'mcp'

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
  const [tab, setTab] = useState<Tab>('general')

  // ── General Audit state ──
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [actionFilter, setActionFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [actionDraft, setActionDraft] = useState('')
  const [userIdDraft, setUserIdDraft] = useState('')
  const [entityTypeDraft, setEntityTypeDraft] = useState('')
  const [fromDraft, setFromDraft] = useState('')
  const [toDraft, setToDraft] = useState('')

  // ── MCP Audit state ──
  const [mcpLogs, setMcpLogs] = useState<McpAuditLog[]>([])
  const [mcpLoading, setMcpLoading] = useState(true)
  const [mcpPage, setMcpPage] = useState(1)
  const [mcpLimit, setMcpLimit] = useState(20)
  const [mcpTotal, setMcpTotal] = useState(0)
  const [mcpTotalPages, setMcpTotalPages] = useState(0)

  const [mcpActionFilter, setMcpActionFilter] = useState('')
  const [mcpClerkIdFilter, setMcpClerkIdFilter] = useState('')
  const [mcpSuccessFilter, setMcpSuccessFilter] = useState('')
  const [mcpToolNameFilter, setMcpToolNameFilter] = useState('')
  const [mcpFromDate, setMcpFromDate] = useState('')
  const [mcpToDate, setMcpToDate] = useState('')

  const [mcpActionDraft, setMcpActionDraft] = useState('')
  const [mcpClerkIdDraft, setMcpClerkIdDraft] = useState('')
  const [mcpSuccessDraft, setMcpSuccessDraft] = useState('')
  const [mcpToolNameDraft, setMcpToolNameDraft] = useState('')
  const [mcpFromDraft, setMcpFromDraft] = useState('')
  const [mcpToDraft, setMcpToDraft] = useState('')

  // Expanded rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // ── Load General logs ──
  useEffect(() => {
    if (tab === 'general') loadLogs()
  }, [tab, page, limit])

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

  // ── Load MCP logs ──
  useEffect(() => {
    if (tab === 'mcp') loadMcpLogs()
  }, [tab, mcpPage, mcpLimit])

  async function loadMcpLogs() {
    setMcpLoading(true)
    try {
      const params: Record<string, any> = { page: mcpPage, limit: mcpLimit }
      if (mcpActionFilter) params.action = mcpActionFilter
      if (mcpClerkIdFilter) params.clerkId = mcpClerkIdFilter
      if (mcpSuccessFilter) params.success = mcpSuccessFilter
      if (mcpToolNameFilter) params.toolName = mcpToolNameFilter
      if (mcpFromDate) params.from = mcpFromDate
      if (mcpToDate) params.to = mcpToDate
      const res = await api.getMcpAuditLogs(params)
      setMcpLogs(res.data || [])
      setMcpTotal(res.pagination?.total || 0)
      setMcpTotalPages(res.pagination?.pages || 0)
    } catch (err) {
      console.error('Error loading MCP audit logs:', err)
    } finally {
      setMcpLoading(false)
    }
  }

  function applyMcpFilters() {
    setMcpActionFilter(mcpActionDraft)
    setMcpClerkIdFilter(mcpClerkIdDraft)
    setMcpSuccessFilter(mcpSuccessDraft)
    setMcpToolNameFilter(mcpToolNameDraft)
    setMcpFromDate(mcpFromDraft)
    setMcpToDate(mcpToDraft)
    setMcpPage(1)
  }

  function clearMcpFilters() {
    setMcpActionDraft('')
    setMcpClerkIdDraft('')
    setMcpSuccessDraft('')
    setMcpToolNameDraft('')
    setMcpFromDraft('')
    setMcpToDraft('')
    setMcpActionFilter('')
    setMcpClerkIdFilter('')
    setMcpSuccessFilter('')
    setMcpToolNameFilter('')
    setMcpFromDate('')
    setMcpToDate('')
    setMcpPage(1)
  }

  function toggleRow(id: string) {
    setExpandedRow(expandedRow === id ? null : id)
  }

  function switchTab(newTab: Tab) {
    setTab(newTab)
    setExpandedRow(null)
  }

  const hasActiveFilters = actionFilter || userIdFilter || entityTypeFilter || fromDate || toDate
  const mcpHasActiveFilters = mcpActionFilter || mcpClerkIdFilter || mcpSuccessFilter || mcpToolNameFilter || mcpFromDate || mcpToDate

  const bothLoading = (tab === 'general' && loading && logs.length === 0) ||
    (tab === 'mcp' && mcpLoading && mcpLogs.length === 0)

  if (bothLoading) {
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => switchTab('general')}
          style={{
            padding: '0.625rem 1.25rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: tab === 'general' ? 600 : 400,
            color: tab === 'general' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: tab === 'general' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>description</span>
          Auditoría General
        </button>
        <button
          onClick={() => switchTab('mcp')}
          style={{
            padding: '0.625rem 1.25rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: tab === 'mcp' ? 600 : 400,
            color: tab === 'mcp' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: tab === 'mcp' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>terminal</span>
          Auditoría MCP
        </button>
      </div>

      {/* ─── TAB: General ─── */}
      {tab === 'general' && (
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
                    <tr key={log._id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                        {formatDate(log.createdAt)}
                      </td>
                      <td>
                            {log.userName || log.userEmail || (
                              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                {log.userId?.slice(0, 12) ?? '—'}
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
                            {log.entityId?.slice(0, 12) ?? '—'}
                        </code>
                      </td>
                    </tr>
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
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </button>
                  {totalPages > 0 &&
                    Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                      <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
                        {p}
                      </button>
                    ))}
                  <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB: MCP ─── */}
      {tab === 'mcp' && (
        <div className="data-table-wrap">
          <div className="table-header">
            <h3>Filtros</h3>
            <div className="table-filters" style={{ flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Desde:
                <input
                  type="date"
                  value={mcpFromDraft}
                  onChange={(e) => setMcpFromDraft(e.target.value)}
                  style={{ padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Hasta:
                <input
                  type="date"
                  value={mcpToDraft}
                  onChange={(e) => setMcpToDraft(e.target.value)}
                  style={{ padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}
                />
              </label>
              <input
                type="text"
                placeholder="Acción..."
                value={mcpActionDraft}
                onChange={(e) => setMcpActionDraft(e.target.value)}
                style={{ width: '140px' }}
              />
              <input
                type="text"
                placeholder="Clerk ID..."
                value={mcpClerkIdDraft}
                onChange={(e) => setMcpClerkIdDraft(e.target.value)}
                style={{ width: '140px' }}
              />
              <input
                type="text"
                placeholder="Tool name..."
                value={mcpToolNameDraft}
                onChange={(e) => setMcpToolNameDraft(e.target.value)}
                style={{ width: '140px' }}
              />
              <select
                value={mcpSuccessDraft}
                onChange={(e) => setMcpSuccessDraft(e.target.value)}
                style={{ width: '120px', padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8125rem', background: 'var(--bg-primary)' }}
              >
                <option value="">Todos</option>
                <option value="true">Éxito</option>
                <option value="false">Error</option>
              </select>
              <button className="action-btn primary" onClick={applyMcpFilters}>
                Aplicar filtros
              </button>
              {mcpHasActiveFilters && (
                <button className="action-btn secondary" onClick={clearMcpFilters}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {mcpLogs.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-rounded">terminal</span>
              <p>No hay registros de auditoría MCP{mcpHasActiveFilters ? ' con los filtros seleccionados' : ''}</p>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Clerk ID</th>
                    <th>Acción</th>
                    <th>Tool</th>
                    <th>Estado</th>
                    <th>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {mcpLogs.map((log) => (
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
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            {log.clerkId?.slice(0, 12) ?? '—'}
                          </code>
                        </td>
                        <td>
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            {log.action}
                          </code>
                        </td>
                        <td>
                          {log.toolName ? (
                            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                              {log.toolName}
                            </code>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          {log.success ? (
                            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.8125rem' }}>✓ Éxito</span>
                          ) : (
                            <span style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.8125rem' }}>✗ Error</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {log.durationMs != null ? `${log.durationMs}ms` : '—'}
                        </td>
                      </tr>
                      {expandedRow === log._id && (
                        <tr key={`${log._id}-detail`}>
                          <td colSpan={6} style={{ padding: '0', background: 'var(--bg-tertiary)' }}>
                            <div style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div>
                                  <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    Recurso
                                  </h4>
                                  <div style={{ fontSize: '0.8125rem' }}>
                                    {log.resourceType && <div><span style={{ color: 'var(--text-muted)' }}>Tipo: </span>{log.resourceType}</div>}
                                    {log.resourceId && <div><span style={{ color: 'var(--text-muted)' }}>ID: </span><code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{log.resourceId}</code></div>}
                                  </div>
                                </div>
                                <div>
                                  <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    Rol
                                  </h4>
                                  <div style={{ fontSize: '0.8125rem' }}>
                                    {log.role || '—'}
                                  </div>
                                </div>
                              </div>
                              {log.errorCode && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    Error
                                  </h4>
                                  <div style={{
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    borderRadius: '8px',
                                    padding: '0.75rem',
                                    fontSize: '0.8125rem',
                                  }}>
                                    <strong>{log.errorCode}</strong>: {log.errorMessage}
                                  </div>
                                </div>
                              )}
                              {(log.ipAddress || log.userAgent) && (
                                <div>
                                  <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    Metadatos
                                  </h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem' }}>
                                    {log.ipAddress && (
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>IP:</span>
                                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{log.ipAddress}</code>
                                      </div>
                                    )}
                                    {log.userAgent && (
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>User-Agent:</span>
                                        <span style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{log.userAgent}</span>
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
                    Página {mcpPage} de {mcpTotalPages || 1} ({mcpTotal} registros)
                  </span>
                  <select
                    value={mcpLimit}
                    onChange={(e) => { setMcpLimit(Number(e.target.value)); setMcpPage(1) }}
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
                  <button disabled={mcpPage === 1} onClick={() => setMcpPage((p) => p - 1)}>
                    Anterior
                  </button>
                  {mcpTotalPages > 0 &&
                    Array.from({ length: Math.min(5, mcpTotalPages) }, (_, i) => i + 1).map((p) => (
                      <button key={p} className={mcpPage === p ? 'active' : ''} onClick={() => setMcpPage(p)}>
                        {p}
                      </button>
                    ))}
                  <button disabled={mcpPage === mcpTotalPages} onClick={() => setMcpPage((p) => p + 1)}>
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
