import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

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
  const [ride, setRide] = useState<Ride | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRide()
  }, [id])

  async function loadRide() {
    try {
      const response = await fetch(`/api/rides/${id}`)
      const data = await response.json()
      setRide(data)
    } catch (error) {
      console.error('Error loading ride:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {\n  if (!confirm('¿Estás seguro de cancelar este pedido?')) return
    
    try {
      await fetch(`/api/rides/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelado por el cliente' }),
      })
      loadRide()
    } catch (error) {
      console.error('Error canceling ride:', error)
    }
  }

  async function handleConfirmDelivery() {
    try {
      await fetch(`/api/rides/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      loadRide()
    } catch (error) {
      console.error('Error confirming delivery:', error)
    }
  }

  if (loading) return <div>Cargando...</div>
  if (!ride) return <div>Pedido no encontrado</div>

  const isOwner = user?.id === ride.clientId
  const canEdit = ride.status === 'requested' || ride.status === 'negotiating'
  const canCancel = ride.status === 'requested' || ride.status === 'negotiating' || ride.status === 'accepted'

  return (
    <div>
      <Link to="/my-rides" style={{ display: 'inline-block', marginBottom: '1rem' }}>
        ← Volver a Mis Pedidos
      </Link>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
          <h1>{ride.title}</h1>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius)',
            background: 'var(--primary)',
            color: 'white',
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
            <strong>📍 Recogida</strong>
            <p>{ride.pickupLocation.address}</p>
          </div>
          <div>
            <strong>🏁 Entrega</strong>
            <p>{ride.dropoffLocation.address}</p>
          </div>
        </div>

        {/* Price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p>Tipo: {ride.type}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              ${ride.finalPrice || ride.estimatedPrice}
            </p>
          </div>
          
          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canCancel && isOwner && (
              <button className="btn btn-outline" onClick={handleCancel}>
                Cancelar
              </button>
            )}
            {ride.status === 'in_progress' && isOwner && (
              <button className="btn btn-primary" onClick={handleConfirmDelivery}>
                Confirmar Entrega
              </button>
            )}
          </div>
        </div>

        {/* Chat */}
        {(ride.status === 'negotiating' || ride.status === 'accepted' || ride.status === 'in_progress') && (
          <div style={{ marginTop: '1.5rem' }}>
            <Link to={`/chat/${ride._id}`} className="btn btn-secondary">
              💬 Abrir Chat
            </Link>
          </div>
        )}

        {/* Delivery photo */}
        {ride.deliveryPhoto && (
          <div style={{ marginTop: '1.5rem' }}>
            <strong>Foto de Entrega</strong>
            <img 
              src={ride.deliveryPhoto.url} 
              alt="Delivery" 
              style={{ marginTop: '0.5rem', maxWidth: '300px', borderRadius: 'var(--radius)' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default RideDetails