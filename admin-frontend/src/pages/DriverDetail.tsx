import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'

interface DriverDetail {
  userId: string
  verificationStatus: string
  rejectionReason?: string
  vehicleType: string
  plate: string
  capacityKg: number
  phone: string
  licenseType: string
  rating: number
  totalRides: number
  isAvailable: boolean
  createdAt: string
  updatedAt: string
  user?: {
    firstName?: string
    lastName?: string
    email: string
    imageUrl?: string
  }
  vehicleImages?: string[]
  licenseImage?: string
  cedulaFront?: string
  cedulaBack?: string
  ruvDocument?: string
  plateImage?: string
  insurancePolicy?: string
}

export default function DriverDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [driver, setDriver] = useState<DriverDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    if (!userId) return
    api
      .getDriver(userId)
      .then(setDriver)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  async function handleApprove() {
    if (!userId) return
    setActionLoading(true)
    try {
      await api.approveDriver(userId)
      setDriver((d) => (d ? { ...d, verificationStatus: 'verified' } : d))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!userId || !rejectReason) return
    setActionLoading(true)
    try {
      await api.rejectDriver(userId, rejectReason)
      setDriver((d) =>
        d ? { ...d, verificationStatus: 'rejected', rejectionReason: rejectReason } : d
      )
      setShowRejectModal(false)
      setRejectReason('')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReview() {
    if (!userId) return
    setActionLoading(true)
    try {
      await api.reviewDriver(userId)
      setDriver((d) => (d ? { ...d, verificationStatus: 'in_review' } : d))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSuspend() {
    if (!userId) return
    if (!confirm('¿Suspender este conductor?')) return
    setActionLoading(true)
    try {
      await api.suspendDriver(userId)
      setDriver((d) =>
        d ? { ...d, verificationStatus: 'suspended', isAvailable: false } : d
      )
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnsuspend() {
    if (!userId) return
    if (!confirm('¿Quitar la suspensión de este conductor?')) return
    setActionLoading(true)
    try {
      await api.unsuspendDriver(userId)
      setDriver((d) =>
        d ? { ...d, verificationStatus: 'verified', isAvailable: true, rejectionReason: '' } : d
      )
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="empty-state">
        <span className="material-symbols-rounded">person_off</span>
        <p>Conductor no encontrado</p>
        <button onClick={() => navigate(-1)} className="action-btn secondary" style={{ marginTop: '1rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
          Volver
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="action-btn secondary" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              arrow_back
            </span>
            Volver
          </button>
          <h2>Detalle del Conductor</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="data-table-wrap">
          <div className="table-header">
            <h3>Información del Usuario</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div className="detail-row">
              <span className="detail-label">Nombre</span>
              <span className="detail-value">
                {driver.user?.firstName || driver.user?.lastName
                  ? `${driver.user?.firstName || ''} ${driver.user?.lastName || ''}`.trim()
                  : 'Sin nombre'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{driver.user?.email || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Teléfono</span>
              <span className="detail-value">{driver.phone || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Estado</span>
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
            </div>
            {driver.rejectionReason && (
              <div className="detail-row">
                <span className="detail-label">Motivo</span>
                <span className="detail-value" style={{ color: 'var(--error)' }}>
                  {driver.rejectionReason}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="data-table-wrap">
          <div className="table-header">
            <h3>Información del Vehículo</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div className="detail-row">
              <span className="detail-label">Tipo</span>
              <span className="detail-value">{driver.vehicleType}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Placa</span>
              <span className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {driver.plate}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Capacidad</span>
              <span className="detail-value">{driver.capacityKg} kg</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Licencia</span>
              <span className="detail-value">{driver.licenseType}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Rating</span>
              <span className="detail-value">
                <span style={{ color: '#F59E0B' }}>★</span> {driver.rating?.toFixed(1) || '0.0'} ({driver.totalRides || 0} viajes)
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Registrado</span>
              <span className="detail-value">
                {new Date(driver.createdAt).toLocaleDateString('es-ES')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="data-table-wrap" style={{ marginTop: '1.5rem' }}>
        <div className="table-header">
          <h3>Documentos</h3>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {driver.vehicleImages?.map((img, i) => (
              <div key={i}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Foto del vehículo {i + 1}
                </p>
                <img
                  src={img}
                  alt={` vehicle ${i + 1}`}
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            ))}
            {driver.licenseImage && (
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Licencia de conducir
                </p>
                <img
                  src={driver.licenseImage}
                  alt="license"
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            )}
            {driver.cedulaFront && (
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Cédula (frente)
                </p>
                <img
                  src={driver.cedulaFront}
                  alt="cedula front"
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            )}
            {driver.cedulaBack && (
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Cédula (reverso)
                </p>
                <img
                  src={driver.cedulaBack}
                  alt="cedula back"
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            )}
            {driver.ruvDocument && (
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  RUV
                </p>
                <img
                  src={driver.ruvDocument}
                  alt="ruv"
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            )}
            {driver.plateImage && (
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Foto de placa
                </p>
                <img
                  src={driver.plateImage}
                  alt="plate"
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            )}
            {driver.insurancePolicy && (
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Póliza de seguro
                </p>
                <img
                  src={driver.insurancePolicy}
                  alt="insurance"
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="data-table-wrap" style={{ marginTop: '1.5rem' }}>
        <div className="table-header">
          <h3>Acciones de Admin</h3>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(driver.verificationStatus === 'pending' ||
            driver.verificationStatus === 'in_review') && (
            <>
              <button
                className="action-btn success"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  check_circle
                </span>
                Aprobar
              </button>
              <button
                className="action-btn danger"
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  cancel
                </span>
                Rechazar
              </button>
              {driver.verificationStatus === 'pending' && (
                <button
                  className="action-btn secondary"
                  onClick={handleReview}
                  disabled={actionLoading}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    visibility
                  </span>
                  Marcar en revisión
                </button>
              )}
            </>
          )}
          {driver.verificationStatus === 'verified' && (
            <button
              className="action-btn danger"
              onClick={handleSuspend}
              disabled={actionLoading}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                block
              </span>
              Suspender
            </button>
          )}
          {driver.verificationStatus === 'suspended' && (
            <button
              className="action-btn warning"
              onClick={handleUnsuspend}
              disabled={actionLoading}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                check_circle
              </span>
              Quitar Suspensión
            </button>
          )}
          <button onClick={() => navigate(-1)} className="action-btn secondary" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            Volver
          </button>
        </div>
      </div>

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rechazar Conductor</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="modal-body">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Motivo del rechazo
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  resize: 'vertical',
                }}
              />
            </div>
            <div className="modal-footer">
              <button className="action-btn secondary" onClick={() => setShowRejectModal(false)}>
                Cancelar
              </button>
              <button
                className="action-btn danger"
                onClick={handleReject}
                disabled={!rejectReason || actionLoading}
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}