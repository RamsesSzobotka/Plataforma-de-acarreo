import { useState, FormEvent } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { paymentsAPI, ridesAPI } from '../services/api'
import type { Ride } from '../types'

interface PaymentFormProps {
  ride: Ride
  onPaymentSuccess: (updatedRide: Ride) => void
  onPaymentError: (error: string) => void
}

export function PaymentForm({
  ride,
  onPaymentSuccess,
  onPaymentError,
}: PaymentFormProps) {
  const { getToken } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Validar que el ride esté en estado completed
  if (ride.status !== 'completed') {
    return (
      <div style={{ padding: '1rem', color: '#64748B' }}>
        El pago solo está disponible después de confirmar la entrega.
      </div>
    )
  }

  const finalPrice = ride.finalPrice || ride.estimatedPrice

  async function handlePaymentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setLoading(true)
    setError(null)

    try {
      const token = await getToken()
      await paymentsAPI.chargeRide(ride._id, token || undefined)

      const updatedRide = await ridesAPI.get(ride._id, token || undefined)
      setSuccess(true)
      onPaymentSuccess(updatedRide)

      setTimeout(() => {
        setSuccess(false)
      }, 5000)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido en el pago'
      setError(message)
      onPaymentError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        backgroundColor: '#F8FAFC',
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '18px', fontWeight: 600, color: '#0F172A' }}>
        💳 Pagar ${finalPrice.toFixed(2)}
      </h3>

      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#334155',
          border: '1px solid #E2E8F0',
        }}
      >
        <p style={{ margin: 0 }}>
          El cobro se ejecutará contra el método de pago guardado en tu perfil y el backend dividirá automáticamente 90/10.
        </p>
      </div>

      <form onSubmit={handlePaymentSubmit}>
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
            Este paso no requiere ingresar tarjeta de nuevo. Se usa el método guardado.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              borderRadius: '6px',
              fontSize: '14px',
              border: '1px solid #FECACA',
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#DCFCE7',
              color: '#166534',
              borderRadius: '6px',
              fontSize: '14px',
              border: '1px solid #BBF7D0',
            }}
          >
            ✅ ¡Pago completado exitosamente!
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: loading ? '#CBD5E1' : '#0D9488',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!loading && e.currentTarget.disabled === false) {
              e.currentTarget.style.backgroundColor = '#0F766E'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && e.currentTarget.disabled === false) {
              e.currentTarget.style.backgroundColor = '#0D9488'
            }
          }}
        >
          {loading ? '🔄 Procesando...' : `💳 Pagar $${finalPrice.toFixed(2)}`}
        </button>

        {/* Info message */}
        <div
          style={{
            marginTop: '1rem',
            fontSize: '12px',
            color: '#64748B',
            textAlign: 'center',
          }}
        >
          💡 Tu información de pago es procesada de forma segura por Stripe
        </div>
      </form>
    </div>
  )
}
