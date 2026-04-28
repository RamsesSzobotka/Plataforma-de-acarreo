import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { PaymentForm } from '../components/PaymentForm'
import { ridesAPI, paymentsAPI } from '../services/api'
import type { RideDetailsResponse } from '../types'

function RideDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const [response, setResponse] = useState<RideDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string>('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadRide()
  }, [id])

  async function loadRide() {
    try {
      if (!id) return
      const data = await ridesAPI.get(id)
      setResponse(data)
    } catch (err) {
      console.error('Error loading ride:', err)
    } finally {
      setLoading(false)
    }
  }

  // Polling cada 3 segundos cuando el ride está en requested o negotiating
  useEffect(() => {
    if (!response?.ride || !['requested', 'negotiating'].includes(response.ride.status)) return

    const interval = setInterval(() => {
      loadRide()
    }, 3000)

    return () => clearInterval(interval)
  }, [response?.ride?.status])

  // Get ride from response - after state is set
  const ride = response?.ride

  async function handleAccept() {
    if (!ride || !user) return
    setActionLoading(true)
    setError('')
    try {
      const agreedPrice = ride.estimatedPrice
      const updated = await ridesAPI.accept(ride._id, agreedPrice)
      // Recargar para obtener datos completos del driver
      await loadRide()
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
      await loadRide()
      alert('¡Viaje iniciado! Tu ubicación está siendo compartida.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar el viaje'
      setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConfirmDelivery() {
    if (!confirm('¿Confirmas que la entrega está completa?\n\nNota: Se cobrará automáticamente a tu forma de pago guardada.')) {
      return
    }

    try {
      await ridesAPI.updateStatus(ride!._id, 'completed')
      await loadRide()
    } catch (err) {
      console.error('Error confirming delivery:', err)
      alert(`Error: ${err instanceof Error ? err.message : 'Error al confirmar entrega'}`)
    }
  }

  async function handlePaymentSuccess(updatedRide: any) {
    await loadRide()
    setShowPaymentForm(false)
  }

  async function handlePaymentError(err: string) {
    setPaymentError(err)
  }

  // Pago simulado (para demo sin Stripe real)
  async function handleSimulatedPayment() {
    if (!ride) return
    setPaying(true)
    setPaymentError('')
    try {
      await paymentsAPI.confirmPaymentSimulated(ride._id)
      await loadRide()
      alert('¡Pago confirmado! Gracias por usar Plataforma de Acarreos')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar pago'
      setPaymentError(message)
    } finally {
      setPaying(false)
    }
  }

  async function handleRate() {
    if (!ride || rating === 0 || !user) return
    try {
      const res = await fetch(`/api/rides/${id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment,
          raterId: user.id,
        }),
      })
      if (res.ok) {
        alert('Calificación enviada')
        setRating(0)
        setComment('')
        loadRide()
      }
    } catch (err) {
      console.error('Error rating:', err)
    }
  }

  async function handleCancel() {
    if (!ride || !confirm('¿Estás seguro de que deseas cancelar este pedido?')) {
      return
    }

    try {
      const res = await ridesAPI.cancel(ride._id, 'Cancelado por el usuario')
      setResponse({ ...response!, ride: res } as RideDetailsResponse)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cancelar'
      setError(message)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando pedido...</div>
  if (!ride) return <div style={{ textAlign: 'center', padding: '2rem' }}>Pedido no encontrado</div>

  const isOwner = user?.id === ride.clientId
  const isDriver = user?.id === ride.driverId
  const canConfirmDelivery = ride.status === 'in_progress' && isOwner
  const canCancel = ['requested', 'negotiating', 'accepted'].includes(ride.status)

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
        {(ride.status === 'accepted' || ride.status === 'in_progress' || ride.status === 'completed') && response?.driver && response.driverUser && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="material-symbols-rounded">person</span>
              Conductor Asignado
            </strong>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {response.driverUser.imageUrl && (
                <img 
                  src={response.driverUser.imageUrl} 
                  alt={response.driverUser.firstName}
                  style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <div>
                <p style={{ fontWeight: 'bold' }}>
                  {response.driverUser.firstName} {response.driverUser.lastName}
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  ⭐ {response.driver.rating} ({response.driver.totalRides} viajes)
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  🚗 {response.driver.vehicleType} - {response.driver.plate}
                </p>
              </div>
            </div>
            <Link 
              to={`/driver/profile/${response.driverUser.clerkId}`}
              style={{ 
                marginTop: '0.75rem', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: 'var(--primary)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>visibility</span>
              Ver perfil del conductor
            </Link>
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
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tipo: {ride.type}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              ${ride.finalPrice || ride.estimatedPrice}
            </p>
          </div>
          
          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {canCancel && isOwner && (
              <button className="btn btn-outline" onClick={handleCancel}>
                <span className="material-symbols-rounded">cancel</span>
                Cancelar
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

            {/* Botón Pagar (solo si no hay Stripe o para demo) */}
            {ride.status === 'completed' && isOwner && !showPaymentForm && (
              <button 
                className="btn btn-primary" 
                onClick={handleSimulatedPayment}
                disabled={paying}
                style={{ backgroundColor: paying ? '#94a3b8' : undefined }}
              >
                <span className="material-symbols-rounded">payment</span>
                {paying ? 'Procesando...' : `Pagar $${ride.finalPrice || ride.estimatedPrice}`}
              </button>
            )}

            {/* Estado pagado */}
            {ride.status === 'paid' && isOwner && (
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#DCFCE7', 
                borderRadius: '6px', 
                textAlign: 'center', 
                color: '#166534', 
                fontWeight: 600,
                border: '1px solid #86efac'
              }}>
                ✅ Pago confirmado - Gracias por usar Plataforma de Acarreos
              </div>
            )}
          </div>
        </div>

        {/* Info: Auto-charge notification */}
        {ride.status === 'completed' && isOwner && !ride.paidAt && (
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
                Se cobró automáticamente ${ride.finalPrice || ride.estimatedPrice} a la forma de pago que guardaste al crear el pedido.
                Si hubo algún problema, puedes hacer clic en "Pagar" arriba para intentar nuevamente.
              </p>
            </div>
          </div>
        )}

        {/* Payment Form */}
        {showPaymentForm && ride.status === 'completed' && isOwner && (
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