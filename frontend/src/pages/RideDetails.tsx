import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { PaymentForm } from '../components/PaymentForm'
import { ridesAPI, usersAPI } from '../services/api'

interface Ride {
  _id: string
  clientId: string
  driverId?: string
  title: string
  description: string
  type: 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros'
  images: { url: string }[]
  pickupLocation: { address: string; type?: string; coordinates: [number, number] }
  dropoffLocation: { address: string; type?: string; coordinates: [number, number] }
  estimatedPrice: number
  finalPrice?: number
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled'
  deliveryPhoto?: { url: string }
  createdAt: string
  updatedAt: string
  chatEnabled: boolean
  paymentIntentId?: string
  paidAt?: string
  stripePaymentMethodId?: string
}

interface Driver {
  _id: string
  userId: string
  vehicleType: string
  plate: string
  rating: number
  totalRides: number
}

interface User {
  _id: string
  clerkId: string
  firstName?: string
  lastName?: string
  imageUrl?: string
}

function RideDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const { getToken } = useAuth()
  const [ride, setRide] = useState<Ride | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [driverUser, setDriverUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  useEffect(() => {
    loadRide()
  }, [id])

  async function loadRide() {
    if (!id) {
      setLoading(false)
      return
    }

    try {
      const token = await getToken()
      const data = await ridesAPI.get(id, token || undefined)
      setRide(data)

      // Cargar info del conductor si existe
      if (data.driverId) {
        const driverData = await usersAPI.get(data.driverId, token || undefined)
        setDriverUser(driverData)

        // Cargar perfil del conductor
        const driverProfile = await usersAPI.getDriver(data.driverId, token || undefined)
        setDriver(driverProfile)
      }
    } catch (error) {
      console.error('Error loading ride:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!id) return
    if (!confirm('Estas seguro de cancelar este pedido?')) return
    
    try {
      const token = await getToken()
      await ridesAPI.cancel(id, 'Cancelado por el cliente', token || undefined)
      loadRide()
    } catch (error) {
      console.error('Error canceling ride:', error)
    }
  }

  async function handleConfirmDelivery() {
    if (!user || !ride || !id) return
    
    const confirmMessage = ride.stripePaymentMethodId 
      ? '¿Confirmas que la entrega está completa?\n\nNota: Se cobrará automáticamente a tu forma de pago guardada.'
      : '¿Confirmas que la entrega está completa?\n\nNota: Necesitarás agregar un método de pago después.'
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Sesion no valida. Inicia sesion nuevamente.')

      // Usar el nuevo endpoint confirm-delivery
      const response = await fetch(`/api/rides/${id}/confirm-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al confirmar entrega')
      }

      const result = await response.json()
      
      // Mostrar mensaje según el resultado
      if (result.message?.includes('pagado')) {
        alert('✅ Entrega confirmada y pago procesado exitosamente')
      } else {
        alert('✅ Entrega confirmada. Puedes proceder con el pago.')
      }
      
      loadRide()
    } catch (error) {
      console.error('Error confirming delivery:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Error al confirmar entrega'}`)
    }
  }

  async function handlePaymentSuccess(updatedRide: Ride) {
    setRide(updatedRide)
    setShowPaymentForm(false)
    // Recargar después de un momento para asegurar que el webhook procesó
    setTimeout(() => loadRide(), 2000)
  }

  async function handlePaymentError(error: string) {
    setPaymentError(error)
  }

  async function handleRate() {
    if (!ride || rating === 0 || !user || !id) return
    try {
      const token = await getToken()
      if (!token) throw new Error('Sesion no valida. Inicia sesion nuevamente.')
      const response = await fetch(`/api/rides/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          comment,
          raterId: user.id,
        }),
      })
      if (response.ok) {
        alert('Calificación enviada')
        setRating(0)
        setComment('')
        loadRide()
      }
    } catch (error) {
      console.error('Error rating:', error)
    }
  }

  if (loading) return <div>Cargando...</div>
  if (!ride) return <div>Pedido no encontrado</div>

  const isClientOwner = user?.id === ride.clientId
  const isDriverOwner = user?.id === ride.driverId
  const isOwner = isClientOwner
  const canClientCancel = isClientOwner && (ride.status === 'requested' || ride.status === 'negotiating')
  const canDriverCancel = isDriverOwner && ride.status === 'accepted'
  
  // Badge de estado con colores
  const statusColors: Record<string, string> = {
    requested: '#F59E0B',
    negotiating: '#F59E0B',
    accepted: '#F97316',
    in_progress: '#0D9488',
    completed: '#22C55E',
    paid: '#22C55E',
    cancelled: '#EF4444',
  }
  const statusColor = statusColors[ride.status] || '#64748B'
  
  const statusLabels: Record<string, string> = {
    requested: 'Pendiente',
    negotiating: 'En negociación',
    accepted: 'Aceptado',
    in_progress: 'En camino',
    completed: 'Completado',
    paid: 'Pagado',
    cancelled: 'Cancelado',
  }

  return (
    <div>
      <Link to="/my-rides" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span className="material-symbols-rounded">arrow_back</span>
        Volver a Mis Pedidos
      </Link>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
          <h1>{ride.title}</h1>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            background: statusColor,
            color: 'white',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}>
            {statusLabels[ride.status] || ride.status}
          </span>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {ride.description}
        </p>

        {/* Images */}
        {ride.images && ride.images.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="material-symbols-rounded">image</span>
              Imágenes
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {ride.images.map((img, idx) => (
                <img 
                  key={idx}
                  src={img.url} 
                  alt={`Imagen ${idx + 1}`} 
                  style={{ 
                    width: '100%', 
                    height: '150px', 
                    objectFit: 'cover',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Driver info */}
        {ride.status === 'accepted' && driverUser && driver && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="material-symbols-rounded">person</span>
              Conductor Asignado
            </strong>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {driverUser.imageUrl && (
                <img 
                  src={driverUser.imageUrl} 
                  alt={driverUser.firstName}
                  style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <div>
                <p style={{ fontWeight: 'bold' }}>
                  {driverUser.firstName} {driverUser.lastName}
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  ⭐ {driver.rating} ({driver.totalRides} viajes)
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  🚗 {driver.vehicleType} - {driver.plate}
                </p>
              </div>
            </div>
          </div>
        )}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <p>Tipo: {ride.type}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              ${ride.finalPrice || ride.estimatedPrice}
            </p>
          </div>
          
          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(canClientCancel || canDriverCancel) && (
              <button className="btn btn-outline" onClick={handleCancel}>
                <span className="material-symbols-rounded">cancel</span>
                Cancelar
              </button>
            )}
            {ride.status === 'in_progress' && isClientOwner && (
              <button className="btn btn-primary" onClick={handleConfirmDelivery}>
                <span className="material-symbols-rounded">check_circle</span>
                Confirmar Entrega
              </button>
            )}
            {ride.status === 'completed' && isClientOwner && !ride.stripePaymentMethodId && !showPaymentForm && (
              <Link to={`/add-payment-method?rideId=${ride._id}`} className="btn btn-secondary" style={{ textAlign: 'center' }}>
                <span className="material-symbols-rounded">credit_card</span>
                Agregar Método de Pago
              </Link>
            )}
            {ride.status === 'completed' && isClientOwner && ride.stripePaymentMethodId && !showPaymentForm && (
              <button className="btn btn-primary" onClick={() => setShowPaymentForm(true)}>
                <span className="material-symbols-rounded">payment</span>
                Pagar ${ride.finalPrice || ride.estimatedPrice}
              </button>
            )}
            {(ride.status === 'paid' || (ride.status === 'completed' && ride.paidAt)) && isClientOwner && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: '#DCFCE7', borderRadius: '6px', textAlign: 'center', color: '#166534', fontWeight: 600 }}>
                ✅ Pagado
              </div>
            )}
          </div>
        </div>

        {/* Info: Auto-charge notification */}
        {ride.status === 'completed' && isClientOwner && ride.stripePaymentMethodId && !ride.paidAt && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: '#DBEAFE',
              borderRadius: '8px',
              border: '1px solid #93C5FD',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: '#1E40AF', fontSize: '20px' }}>ℹ️</span>
            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#1E40AF' }}>
                Pago Automático
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#1E40AF' }}>
                Se cobró automáticamente ${ride.finalPrice || ride.estimatedPrice} a tu forma de pago guardada.
                Si hubo algún problema, puedes hacer clic en "Pagar" arriba para intentar nuevamente.
              </p>
            </div>
          </div>
        )}
        
        {ride.status === 'completed' && isClientOwner && !ride.stripePaymentMethodId && !ride.paidAt && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: '#FEF3C7',
              borderRadius: '8px',
              border: '1px solid #FCD34D',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: '#92400E', fontSize: '20px' }}>⚠️</span>
            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#92400E' }}>
                Método de Pago Requerido
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#92400E' }}>
                Debes agregar un método de pago para completar el pedido.
              </p>
            </div>
          </div>
        )}

        {/* Payment Form */}
        {showPaymentForm && ride.status === 'completed' && isClientOwner && (
          <div style={{ marginTop: '1.5rem' }}>
            {paymentError && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', border: '1px solid #FECACA' }}>
                {paymentError}
              </div>
            )}
            <PaymentForm 
              ride={ride}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={handlePaymentError}
            />
            <button 
              onClick={() => {
                setShowPaymentForm(false)
                setPaymentError(null)
              }}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#E2E8F0',
                color: '#0F172A',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Chat */}
        {(ride.status === 'negotiating' || ride.status === 'accepted' || ride.status === 'in_progress') && (
          <div style={{ marginTop: '1.5rem' }}>
            <Link to={`/chat/${ride._id}`} className="btn btn-secondary">
              <span className="material-symbols-rounded">chat</span>
              Abrir Chat
            </Link>
          </div>
        )}

        {/* Delivery photo */}
        {ride.deliveryPhoto && (
          <div style={{ marginTop: '1.5rem' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-rounded">photo_camera</span>
              Foto de Entrega
            </strong>
            <img 
              src={ride.deliveryPhoto.url} 
              alt="Delivery" 
              style={{ marginTop: '0.5rem', maxWidth: '300px', borderRadius: 'var(--radius)' }}
            />
          </div>
        )}

        {/* Rating */}
        {ride.status === 'paid' && isOwner && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="material-symbols-rounded">star</span>
              Calificar Conductor
            </strong>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      opacity: rating >= star ? 1 : 0.3,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Comentario (opcional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-body)',
                  marginBottom: '0.75rem',
                }}
              />
              <button 
                onClick={handleRate}
                disabled={rating === 0}
                className="btn btn-primary"
                style={{ opacity: rating === 0 ? 0.5 : 1 }}
              >
                <span className="material-symbols-rounded">check</span>
                Enviar Calificación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RideDetails