import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { ridesAPI } from '../services/api'

interface Ride {
  _id: string
  clientId: string
  driverId?: string
  title: string
  description: string
  type: string
  images: { url: string }[]
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  estimatedPrice: number
  finalPrice?: number
  status: string
  deliveryPhoto?: { url: string }
  createdAt: string
}

function RideDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const navigate = useNavigate()
  const [ride, setRide] = useState<Ride | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadRide()
  }, [id])

  async function loadRide() {
    try {
      if (!id) return
      const data = await ridesAPI.get(id)
      setRide(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar el pedido'
      setError(message)
      console.error('Error loading ride:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!ride || !user) return
    setActionLoading(true)
    setError('')
    try {
      const agreedPrice = ride.estimatedPrice
      const updated = await ridesAPI.accept(ride._id, agreedPrice)
      setRide(updated)
      alert('¡Pedido aceptado! Ahora puedes chatear con el cliente.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al aceptar el pedido'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleStart() {
    if (!ride || !user) return
    setActionLoading(true)
    setError('')
    try {
      const updated = await ridesAPI.start(ride._id)
      setRide(updated)
      alert('¡Viaje iniciado! Tu ubicación está siendo compartida.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar el viaje'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConfirmDelivery() {
    if (!ride || !user) return
    setActionLoading(true)
    setError('')
    try {
      const updated = await ridesAPI.updateStatus(ride._id, 'completed')
      setRide(updated)
      alert('¡Entrega confirmada! El driver debe subir la foto.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al confirmar la entrega'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!ride || !user) return
    const reason = window.prompt('¿Por qué deseas cancelar este pedido?')
    if (!reason) return
    
    setActionLoading(true)
    setError('')
    try {
      const updated = await ridesAPI.cancel(ride._id, reason)
      setRide(updated)
      alert('Pedido cancelado.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cancelar el pedido'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando pedido...</div>
  if (!ride) return <div style={{ textAlign: 'center', padding: '2rem' }}>Pedido no encontrado</div>

  const isOwner = user?.id === ride.clientId
  const isDriver = user?.id === ride.driverId
  const canAccept = ride.status === 'requested' && !isOwner
  const canStart = ride.status === 'accepted' && isDriver
  const canConfirmDelivery = ride.status === 'in_progress' && isOwner
  const canCancel = ['requested', 'negotiating', 'accepted'].includes(ride.status)
  const canChat = ['negotiating', 'accepted', 'in_progress'].includes(ride.status) && (isOwner || isDriver)

  const statusColors: Record<string, string> = {
    requested: '#f59e0b',
    negotiating: '#8b5cf6',
    accepted: '#22c55e',
    in_progress: '#3b82f6',
    completed: '#22c55e',
    paid: '#22c55e',
    cancelled: '#ef4444',
  }

  return (
    <div>
      <Link to="/my-rides" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span className="material-symbols-rounded">arrow_back</span>
        Volver a Mis Pedidos
      </Link>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius)',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
          <h1>{ride.title}</h1>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius)',
            background: statusColors[ride.status] || '#64748b',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}>
            {ride.status}
          </span>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {ride.description}
        </p>

        {/* Route info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-rounded" style={{ color: '#0D9488' }}>location_on</span>
              Recogida
            </strong>
            <p>{ride.pickupLocation.address}</p>
          </div>
          <div>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-rounded" style={{ color: '#F97316' }}>flag</span>
              Entrega
            </strong>
            <p>{ride.dropoffLocation.address}</p>
          </div>
        </div>

        {/* Price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tipo: {ride.type}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              ${ride.finalPrice || ride.estimatedPrice}
            </p>
          </div>
          
          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {canAccept && (
              <button 
                className="btn btn-primary"
                onClick={handleAccept}
                disabled={actionLoading}
              >
                <span className="material-symbols-rounded">check_circle</span>
                Aceptar Pedido
              </button>
            )}

            {canStart && (
              <button 
                className="btn btn-primary"
                onClick={handleStart}
                disabled={actionLoading}
              >
                <span className="material-symbols-rounded">directions</span>
                Iniciar Viaje
              </button>
            )}

            {canConfirmDelivery && (
              <button 
                className="btn btn-primary"
                onClick={handleConfirmDelivery}
                disabled={actionLoading}
              >
                <span className="material-symbols-rounded">check_circle</span>
                Confirmar Entrega
              </button>
            )}

            {canCancel && (
              <button 
                className="btn btn-outline"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                <span className="material-symbols-rounded">cancel</span>
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Chat - Desactivado por errores
        {canChat && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <Link to={`/chat/${ride._id}`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-rounded">chat</span>
              Abrir Chat
            </Link>
          </div>
        )}
        */}

        {/* Delivery photo */}
        {ride.deliveryPhoto && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-rounded">photo_camera</span>
              Foto de Entrega
            </strong>
            <img 
              src={ride.deliveryPhoto.url} 
              alt="Delivery" 
              style={{ marginTop: '0.5rem', maxWidth: '300px', maxHeight: '300px', borderRadius: 'var(--radius)', objectFit: 'cover' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default RideDetails