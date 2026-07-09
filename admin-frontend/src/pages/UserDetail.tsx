import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'

interface UserDetailData {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  role: string
  isActive: boolean
  phone?: string
  createdAt: string
  updatedAt: string
}

interface RideSummary {
  _id: string
  title: string
  status: string
  estimatedPrice: number
  finalPrice?: number
  createdAt: string
  driverId?: { clerkId: string; firstName?: string; lastName?: string }
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  negotiating: 'Negociando',
  accepted: 'Aceptado',
  in_progress: 'En progreso',
  completed: 'Completado',
  paid: 'Pagado',
  cancelled: 'Cancelado',
}

export default function UserDetail() {
  const { clerkId } = useParams<{ clerkId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<UserDetailData | null>(null)
  const [rides, setRides] = useState<RideSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [ridesLoading, setRidesLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!clerkId) return
    setLoading(true)
    api.getUser(clerkId)
      .then(setUser)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clerkId])

  useEffect(() => {
    if (!clerkId) return
    setRidesLoading(true)
    api.getRides({ clientId: clerkId, limit: 10 })
      .then((res: any) => setRides(res.data || []))
      .catch(console.error)
      .finally(() => setRidesLoading(false))
  }, [clerkId])

  async function handleSuspend() {
    if (!clerkId) return
    prompt('Motivo de la suspensión:')
    setActionLoading(true)
    try {
      await api.updateUser(clerkId, { isActive: false })
      setUser((u) => (u ? { ...u, isActive: false } : u))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReactivate() {
    if (!clerkId) return
    setActionLoading(true)
    try {
      await api.updateUser(clerkId, { isActive: true })
      setUser((u) => (u ? { ...u, isActive: true } : u))
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

  if (!user) {
    return (
      <div className="empty-state">
        <span className="material-symbols-rounded">person_off</span>
        <p>Usuario no encontrado</p>
        <Link to="/users" className="action-btn secondary" style={{ marginTop: '1rem' }}>
          Volver a Usuarios
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/users" className="action-btn secondary">
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              arrow_back
            </span>
            Volver
          </Link>
          <h2>Detalle del Usuario</h2>
        </div>
      </div>

      <div className="data-table-wrap">
        <div className="table-header">
          <h3>Información del Usuario</h3>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt="Avatar"
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  color: 'var(--text-muted)',
                }}
              >
                {user.firstName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h3 style={{ margin: 0 }}>
                {user.firstName || user.lastName
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                  : 'Sin nombre'}
              </h3>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>{user.email}</p>
            </div>
          </div>

          <div className="detail-row">
            <span className="detail-label">ID</span>
            <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
              {user.clerkId}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Rol</span>
            <span className={`status-badge ${user.role}`}>
              {user.role === 'client' ? 'Cliente' : user.role === 'driver' ? 'Conductor' : 'Admin'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Estado</span>
            <span className={`status-badge ${user.isActive ? 'verified' : 'cancelled'}`}>
              {user.isActive ? 'Activo' : 'Inactivo / Suspendido'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Teléfono</span>
            <span className="detail-value">{user.phone || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Registrado</span>
            <span className="detail-value">
              {new Date(user.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="data-table-wrap" style={{ marginTop: '1.5rem' }}>
        <div className="table-header">
          <h3>Acarreos del Usuario</h3>
          {rides.length > 0 && (
            <Link to={`/rides?clientId=${clerkId}`} className="action-btn secondary" style={{ fontSize: '0.8125rem' }}>
              Ver todos
            </Link>
          )}
        </div>
        {ridesLoading ? (
          <div className="loading-spinner" style={{ padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : rides.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Sin acarreos
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Conductor</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((ride) => (
                <tr
                  key={ride._id}
                  onClick={() => navigate(`/rides/${ride._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 500 }}>{ride.title}</td>
                  <td>
                    <span className={`status-badge ${ride.status}`}>
                      {STATUS_LABELS[ride.status] || ride.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                    ${(ride.finalPrice || ride.estimatedPrice)?.toFixed(2)}
                  </td>
                  <td>
                    {ride.driverId
                      ? `${ride.driverId.firstName || ''} ${ride.driverId.lastName || ''}`.trim() || '—'
                      : '—'}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {new Date(ride.createdAt).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="data-table-wrap" style={{ marginTop: '1.5rem' }}>
        <div className="table-header">
          <h3>Acciones de Admin</h3>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {user.isActive ? (
            <button
              className="action-btn danger"
              onClick={handleSuspend}
              disabled={actionLoading}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                block
              </span>
              Suspender usuario
            </button>
          ) : (
            <button
              className="action-btn success"
              onClick={handleReactivate}
              disabled={actionLoading}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                check_circle
              </span>
              Quitar suspensión
            </button>
          )}
          <Link to="/users" className="action-btn secondary">
            Volver a Usuarios
          </Link>
        </div>
      </div>
    </div>
  )
}
