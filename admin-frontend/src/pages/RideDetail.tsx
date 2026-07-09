import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'

interface RideDetail {
  _id: string
  title: string
  description: string
  type: string
  status: string
  estimatedPrice: number
  finalPrice?: number
  packages?: number
  weight?: number
  notes?: string
  pickupLocation: { address: string; coordinates: number[] }
  dropoffLocation: { address: string; coordinates: number[] }
  images: { url: string }[]
  deliveryPhoto?: { url: string }
  cancellationReason?: string
  refundId?: string
  paymentIntentId?: string
  clientId?: { firstName?: string; lastName?: string; email: string }
  driverId?: { firstName?: string; lastName?: string; email: string }
  createdAt: string
  updatedAt: string
}

export default function RideDetail() {
  const { id } = useParams<{ id: string }>()
  const [ride, setRide] = useState<RideDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedDriver, setSelectedDriver] = useState('')
  const [newStatus, setNewStatus] = useState('')

  useEffect(() => {
    if (!id) return
    api
      .getRide(id)
      .then(setRide)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  async function handleAssignDriver() {
    if (!id || !selectedDriver) return
    setActionLoading(true)
    try {
      await api.assignDriver(id, selectedDriver)
      const updated = await api.getRide(id!)
      setRide(updated)
      setShowAssignModal(false)
      setSelectedDriver('')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdateStatus() {
    if (!id || !newStatus) return
    setActionLoading(true)
    try {
      await api.updateRideStatus(id, newStatus)
      const updated = await api.getRide(id!)
      setRide(updated)
      setShowStatusModal(false)
      setNewStatus('')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!id) return
    const reason = prompt('Motivo de cancelación:')
    if (!reason) return
    setActionLoading(true)
    try {
      await api.cancelRide(id, reason)
      const updated = await api.getRide(id!)
      setRide(updated)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!id || !confirm('¿Eliminar este pedido?')) return
    setActionLoading(true)
    try {
      await api.deleteRide(id)
      window.location.href = '/rides'
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRefund() {
    if (!id) return
    const reason = prompt('Motivo del reembolso:')
    if (!reason) return
    setActionLoading(true)
    try {
      await api.refundRide(id, { reason })
      alert('Reembolso procesado exitosamente')
      const updated = await api.getRide(id!)
      setRide(updated)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function openAssignModal() {
    setActionLoading(true)
    try {
      const res = await api.getDrivers({ status: 'verified' })
      setDrivers(res.data)
      setShowAssignModal(true)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      requested: 'Solicitado',
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

  if (!ride) {
    return (
      <div className="empty-state">
        <span className="material-symbols-rounded">inventory_2</span>
        <p>Pedido no encontrado</p>
        <Link to="/rides" className="action-btn secondary" style={{ marginTop: '1rem' }}>
          Volver
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/rides" className="action-btn secondary">
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              arrow_back
            </span>
            Volver
          </Link>
          <h2>Detalle del Pedido</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="data-table-wrap">
          <div className="table-header">
            <h3>Información General</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div className="detail-row">
              <span className="detail-label">Título</span>
              <span className="detail-value">{ride.title}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Tipo</span>
              <span className="detail-value">{getTypeLabel(ride.type)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Descripción</span>
              <span className="detail-value">{ride.description}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Estado</span>
              <span className={`status-badge ${ride.status}`}>
                {getStatusLabel(ride.status)}
              </span>
            </div>
            {ride.cancellationReason && (
              <div className="detail-row">
                <span className="detail-label">Motivo</span>
                <span className="detail-value" style={{ color: 'var(--error)' }}>
                  {ride.cancellationReason}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="data-table-wrap">
          <div className="table-header">
            <h3>Precio</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div className="detail-row">
              <span className="detail-label">Precio Sugerido</span>
              <span className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                ${ride.estimatedPrice}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Precio Final</span>
              <span className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                ${ride.finalPrice || '—'}
              </span>
            </div>
            {ride.packages && (
              <div className="detail-row">
                <span className="detail-label">Bultos</span>
                <span className="detail-value">{ride.packages}</span>
              </div>
            )}
            {ride.weight && (
              <div className="detail-row">
                <span className="detail-label">Peso</span>
                <span className="detail-value">{ride.weight} kg</span>
              </div>
            )}
            {ride.notes && (
              <div className="detail-row">
                <span className="detail-label">Notas</span>
                <span className="detail-value">{ride.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div className="data-table-wrap">
          <div className="table-header">
            <h3>Ubicaciones</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div className="detail-row">
              <span className="detail-label">Recoger en</span>
              <span className="detail-value">{ride.pickupLocation.address}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Entregar en</span>
              <span className="detail-value">{ride.dropoffLocation.address}</span>
            </div>
          </div>
        </div>

        <div className="data-table-wrap">
          <div className="table-header">
            <h3>Usuario</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div className="detail-row">
              <span className="detail-label">Cliente</span>
              <span className="detail-value">
                {ride.clientId?.firstName || ride.clientId?.lastName
                  ? `${ride.clientId.firstName || ''} ${ride.clientId.lastName || ''}`.trim()
                  : ride.clientId?.email || '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{ride.clientId?.email || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Conductor</span>
              <span className="detail-value">
                {ride.driverId
                  ? `${ride.driverId.firstName || ''} ${ride.driverId.lastName || ''}`.trim()
                  : '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Creado</span>
              <span className="detail-value">
                {new Date(ride.createdAt).toLocaleString('es-ES')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {ride.images && ride.images.length > 0 && (
        <div className="data-table-wrap" style={{ marginTop: '1.5rem' }}>
          <div className="table-header">
            <h3>Imágenes ({ride.images.length})</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '1rem',
              }}
            >
              {ride.images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={`imagen ${i + 1}`}
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="data-table-wrap" style={{ marginTop: '1.5rem' }}>
        <div className="table-header">
          <h3>Acciones de Admin</h3>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!ride.driverId && ride.status !== 'cancelled' && (
            <button className="action-btn primary" onClick={openAssignModal} disabled={actionLoading}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                person_add
              </span>
              Asignar Conductor
            </button>
          )}
          <button
            className="action-btn secondary"
            onClick={() => {
              setNewStatus(ride.status)
              setShowStatusModal(true)
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              edit
            </span>
            Cambiar Estado
          </button>
          {ride.status !== 'cancelled' && ride.status !== 'completed' && ride.status !== 'paid' && (
            <button className="action-btn danger" onClick={handleCancel} disabled={actionLoading}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                cancel
              </span>
              Cancelar
            </button>
          )}
          {ride.paymentIntentId && ride.status !== 'cancelled' && !ride.refundId && (
            <button className="action-btn danger" onClick={handleRefund} disabled={actionLoading}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                currency_exchange
              </span>
              Reembolsar
            </button>
          )}
          <button className="action-btn danger" onClick={handleDelete} disabled={actionLoading}>
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              delete
            </span>
            Eliminar
          </button>
        </div>
      </div>

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Asignar Conductor</h3>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="modal-body">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Seleccionar conductor
              </label>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
              >
                <option value="">Seleccionar...</option>
                {drivers.map((d) => (
                  <option key={d.userId} value={d.userId}>
                    {d.user?.firstName || d.user?.lastName || d.userId} - {d.plate}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="action-btn secondary" onClick={() => setShowAssignModal(false)}>
                Cancelar
              </button>
              <button className="action-btn primary" onClick={handleAssignDriver} disabled={!selectedDriver || actionLoading}>
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cambiar Estado</h3>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="modal-body">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Nuevo estado
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
              >
                <option value="requested">Solicitado</option>
                <option value="accepted">Aceptado</option>
                <option value="in_progress">En progreso</option>
                <option value="completed">Completado</option>
                <option value="paid">Pagado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="action-btn secondary" onClick={() => setShowStatusModal(false)}>
                Cancelar
              </button>
              <button className="action-btn primary" onClick={handleUpdateStatus} disabled={actionLoading}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}