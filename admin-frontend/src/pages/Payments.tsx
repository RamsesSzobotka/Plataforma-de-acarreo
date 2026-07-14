import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../services/api'

function fmtMoney(n: number) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABELS: Record<string, string> = {
  charged: 'Cobrado',
  transferred: 'Transferido',
  refunded: 'Reembolsado',
  none: 'Sin pago',
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  charged: { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563EB' },
  transferred: { bg: 'rgba(34, 197, 94, 0.1)', color: '#16A34A' },
  refunded: { bg: 'rgba(239, 68, 68, 0.1)', color: '#DC2626' },
}

const SEVERITY_STYLES: Record<string, { bg: string; color: string }> = {
  warning: { bg: 'rgba(245, 158, 11, 0.1)', color: '#D97706' },
  critical: { bg: 'rgba(239, 68, 68, 0.1)', color: '#DC2626' },
}

const DISCREPANCY_LABELS: Record<string, string> = {
  transfer_pending: 'Transferencia pendiente',
  transfer_missing: 'Transferencia faltante',
  refund_pending: 'Reembolso pendiente de aplicar',
  payment_missing: 'Pago faltante',
}

export default function Payments() {
  const navigate = useNavigate()

  const [payments, setPayments] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [summary, setSummary] = useState({ totalProcessed: 0, totalRevenue: 0, totalFees: 0, totalPendingTransfers: 0, discrepancyCount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState('todos')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchText, setSearchText] = useState('')

  const [showDiscModal, setShowDiscModal] = useState(false)

  useEffect(() => {
    loadPayments()
  }, [page, statusFilter])

  async function loadPayments() {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, any> = { page, limit: 20 }
      if (statusFilter !== 'todos') params.status = statusFilter
      if (fromDate) params.from = fromDate
      if (toDate) params.to = toDate
      if (searchText) params.search = searchText

      const res = await api.getPayments(params)
      setPayments(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 0 })
      setSummary(res.summary || { totalProcessed: 0, totalRevenue: 0, totalFees: 0, totalPendingTransfers: 0, discrepancyCount: 0 })
    } catch (err: any) {
      setError(err.message || 'Error al cargar pagos')
    } finally {
      setLoading(false)
    }
  }

  function doSearch() { setPage(1); loadPayments() }

  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') doSearch() }

  function clearFilters() {
    setSearchText(''); setFromDate(''); setToDate('')
    if (searchText || fromDate || toDate) { setPage(1); loadPayments() }
  }

  const filterActive = statusFilter !== 'todos' || !!fromDate || !!toDate || !!searchText

  // Collect all discrepancies across all rides for the modal
  const allDiscrepancies = payments.flatMap((p: any) =>
    (p.discrepancies || []).map((d: any) => ({ ...d, rideId: p._id, rideTitle: p.title }))
  )

  async function handlePayDriver(rideId: string, driverName: string, amount: number) {
    const result = await Swal.fire({
      title: '¿Pagar al conductor?',
      text: `Se transferirán ${fmtMoney(amount)} a ${driverName}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, pagar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#22C55E',
      cancelButtonColor: '#64748B',
      reverseButtons: true,
    })
    if (!result.isConfirmed) return

    setActionLoading(rideId)
    try {
      await api.payDriverRide(rideId, {})
      await Swal.fire({ icon: 'success', title: 'Pago procesado', text: 'El pago al conductor ha sido liberado.', confirmButtonColor: '#0D9488' })
      loadPayments()
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Error al procesar pago' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRefund(rideId: string, amount: number) {
    const result = await Swal.fire({
      title: 'Reembolsar pago',
      text: `Se reembolsarán ${fmtMoney(amount)} al cliente. Esta acción no es reversible.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, reembolsar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#64748B',
      reverseButtons: true,
      input: 'textarea',
      inputPlaceholder: 'Motivo del reembolso (obligatorio)',
      inputValidator: (v) => (v ? undefined : 'Debes ingresar un motivo'),
    })
    if (!result.isConfirmed) return

    setActionLoading(rideId)
    try {
      await api.refundRide(rideId, { reason: result.value })
      await Swal.fire({ icon: 'success', title: 'Reembolso procesado', text: 'El reembolso se ha procesado correctamente.', confirmButtonColor: '#0D9488' })
      loadPayments()
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Error al procesar reembolso' })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && payments.length === 0) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>Pagos — Conciliación</h2>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon-wrap primary">
            <span className="material-symbols-rounded">receipt_long</span>
          </div>
          <div className="stat-info">
            <h3>Total Procesados</h3>
            <p>{summary.totalProcessed}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-wrap success">
            <span className="material-symbols-rounded">payments</span>
          </div>
          <div className="stat-info">
            <h3>Ingresos Totales</h3>
            <p>{fmtMoney(summary.totalRevenue)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-wrap secondary">
            <span className="material-symbols-rounded">percent</span>
          </div>
          <div className="stat-info">
            <h3>Comisiones (10%)</h3>
            <p>{fmtMoney(summary.totalFees)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-wrap warning">
            <span className="material-symbols-rounded">account_balance</span>
          </div>
          <div className="stat-info">
            <h3>Transf. Pendientes</h3>
            <p>
              {summary.totalPendingTransfers}
              {summary.totalPendingTransfers > 0 && (
                <span className="status-badge" style={{ marginLeft: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', color: '#D97706' }}>
                  {summary.totalPendingTransfers}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Discrepancy banner */}
      {summary.discrepancyCount > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem',
            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius)', marginBottom: '1.25rem', cursor: 'pointer',
            color: '#92400E', fontSize: '0.875rem', fontWeight: 500,
          }}
          onClick={() => setShowDiscModal(true)}
        >
          <span className="material-symbols-rounded" style={{ color: '#D97706' }}>warning</span>
          <span style={{ flex: 1 }}>
            {summary.discrepancyCount} discrepancia{summary.discrepancyCount > 1 ? 's' : ''} detectada{summary.discrepancyCount > 1 ? 's' : ''} — Ver detalles
          </span>
          <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#D97706' }}>chevron_right</span>
        </div>
      )}

      {/* Filters */}
      <div className="data-table-wrap">
        <div className="table-header">
          <h3>Todos los pagos</h3>
          <div className="table-filters">
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            >
              <option value="todos">Todos los estados</option>
              <option value="charged">Cobrado</option>
              <option value="transferred">Transferido</option>
              <option value="refunded">Reembolsado</option>
              <option value="discrepancy">Discrepancia</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Desde:
              <input type="date" className="filter-select" style={{ width: 'auto' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Hasta:
              <input type="date" className="filter-select" style={{ width: 'auto' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <input
              type="text" placeholder="Buscar..." value={searchText}
              onChange={(e) => setSearchText(e.target.value)} onKeyDown={handleKeyDown}
              style={{ width: '160px' }}
            />
            {filterActive && (
              <button className="action-btn secondary" onClick={clearFilters} style={{ padding: '0.5rem' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>close</span>
              </button>
            )}
            <button className="action-btn primary" onClick={doSearch}>Buscar</button>
          </div>
        </div>

        {error && (
          <div className="empty-state">
            <span className="material-symbols-rounded">error</span>
            <p>{error}</p>
            <button className="action-btn primary" onClick={loadPayments}>Reintentar</button>
          </div>
        )}

        {!error && payments.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-rounded">payments</span>
            <p>No se encontraron pagos{filterActive ? ' con los filtros seleccionados' : ''}</p>
          </div>
        )}

        {!error && payments.length > 0 && (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ride</th>
                  <th>Cliente</th>
                  <th>Conductor</th>
                  <th>Monto Final</th>
                  <th>Fee (10%)</th>
                  <th>Conductor (90%)</th>
                  <th>Fecha Pago</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => {
                  const ps = p.paymentStatus || 'none'
                  const isDisc = p.discrepancies?.length > 0
                  const hasTransferPending = p.discrepancies?.some((d: any) => d.type === 'transfer_pending')
                  const isCharged = ps === 'charged'
                  const fee = p.platformFee ?? (p.finalPrice ? p.finalPrice * 0.1 : 0)
                  const driverAmt = p.driverAmount ?? (p.finalPrice ? p.finalPrice * 0.9 : 0)

                  return (
                    <tr key={p._id}>
                      <td>
                        <div style={{ maxWidth: '200px' }}>
                          <strong>{(p.title || '').length > 30 ? p.title.slice(0, 30) + '...' : p.title || '—'}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {p._id?.slice(-8) || '—'}
                          </div>
                        </div>
                      </td>
                      <td>
                        {p.client ? (
                          <div className="user-cell">
                            <div className="user-avatar">
                              {(p.client.firstName?.[0] || p.client.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="user-info">
                              <span className="name">
                                {[p.client.firstName, p.client.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                              </span>
                              <span className="email">{p.client.email || ''}</span>
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {p.driver ? (
                          <div className="user-cell">
                            <div className="user-avatar">
                              {(p.driver.firstName?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="user-info">
                              <span className="name">
                                {[p.driver.firstName, p.driver.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                              </span>
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtMoney(p.finalPrice || 0)}</span></td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>{fmtMoney(fee)}</span></td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{fmtMoney(driverAmt)}</span></td>
                      <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{fmtDate(p.paidAt)}</td>
                      <td>
                        {isDisc ? (
                          <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#D97706' }}>
                            ⚠️ Discrepancia
                          </span>
                        ) : (
                          <span className="status-badge" style={STATUS_STYLES[ps] || { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748B' }}>
                            {STATUS_LABELS[ps] || ps}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          <button className="action-btn secondary" onClick={() => navigate(`/rides/${p._id}`)}>
                            Ver
                          </button>
                          {hasTransferPending && (
                            <button
                              className="action-btn success"
                              onClick={() => handlePayDriver(p._id, p.driver ? [p.driver.firstName, p.driver.lastName].filter(Boolean).join(' ') : 'conductor', driverAmt)}
                              disabled={actionLoading === p._id}
                            >
                              Pagar Conductor
                            </button>
                          )}
                          {isCharged && !hasTransferPending && (
                            <button
                              className="action-btn danger"
                              onClick={() => handleRefund(p._id, p.finalPrice || 0)}
                              disabled={actionLoading === p._id}
                            >
                              Reembolsar
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
                Página {pagination.page} de {pagination.pages} ({pagination.total} pagos)
              </span>
              <div className="pagination-buttons">
                <button disabled={pagination.page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map(n => (
                  <button key={n} className={pagination.page === n ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button disabled={pagination.page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Discrepancies modal */}
      {showDiscModal && (
        <div className="modal-overlay" onClick={() => setShowDiscModal(false)}>
          <div className="modal" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Discrepancias Detectadas</h3>
              <button className="modal-close" onClick={() => setShowDiscModal(false)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="modal-body">
              {allDiscrepancies.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No hay discrepancias para mostrar.
                </p>
              ) : (
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Ride</th>
                      <th>Tipo</th>
                      <th>Severidad</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDiscrepancies.map((d: any, i: number) => {
                      const sv = SEVERITY_STYLES[d.severity] || SEVERITY_STYLES.warning
                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ maxWidth: '180px' }}>
                              <strong>{(d.rideTitle || '').length > 25 ? d.rideTitle.slice(0, 25) + '...' : d.rideTitle || '—'}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {(d.rideId || '').slice(-8)}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>{DISCREPANCY_LABELS[d.type] || d.type}</td>
                          <td>
                            <span className="status-badge" style={{ background: sv.bg, color: sv.color }}>
                              {d.severity === 'critical' ? 'Crítica' : 'Advertencia'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="action-btn secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => { setShowDiscModal(false); navigate(`/rides/${d.rideId}`) }}
                            >
                              Ver viaje
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="action-btn secondary" onClick={() => setShowDiscModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
