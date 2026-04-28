import { useState, FormEvent } from 'react'
import {
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
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
  const stripe = useStripe()
  const elements = useElements()

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

    if (!stripe || !elements) {
      setError('Stripe no está cargado correctamente')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Crear PaymentIntent en el backend
      console.log('📱 Creating payment intent...')
      const { clientSecret, paymentIntentId } =
        await paymentsAPI.createPaymentIntent(ride._id, finalPrice)

      console.log('✅ Payment intent created:', paymentIntentId)

      // 2. Confirmar el pago con Stripe Elements
      console.log('💳 Confirming payment with Stripe...')
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element no encontrado')
      }

      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
          },
        })

      if (stripeError) {
        throw new Error(stripeError.message || 'Error al procesar el pago')
      }

      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error('El pago no fue completado correctamente')
      }

      console.log('✅ Payment succeeded:', paymentIntent.id)

      // 3. Confirmar el pago en el backend
      console.log('🔄 Confirming payment in backend...')
      const confirmResult = await paymentsAPI.confirmPayment(
        ride._id,
        paymentIntentId
      )

      if (!confirmResult.success) {
        throw new Error('Error confirmando el pago en el servidor')
      }

      console.log('✅ Payment confirmed in backend')

      // 4. Actualizar la vista del ride para mostrar estado 'paid'
      const updatedRide = await ridesAPI.get(ride._id)
      setSuccess(true)
      onPaymentSuccess(updatedRide)

      // Limpiar mensaje de error y mostrar éxito
      setTimeout(() => {
        setSuccess(false)
      }, 5000)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido en el pago'
      console.error('❌ Payment error:', message)
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
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '18px', fontWeight: 600 }}>
        💳 Pagar ${finalPrice.toFixed(2)}
      </h3>

      {/* Resumen de comisiones */}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <span>Monto total:</span>
          <span style={{ fontWeight: 600 }}>${finalPrice.toFixed(2)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
            fontSize: '13px',
            color: '#64748B',
          }}
        >
          <span>Conductor recibe (90%):</span>
          <span>${(finalPrice * 0.9).toFixed(2)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: '#64748B',
            paddingTop: '0.5rem',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          <span>Comisión plataforma (10%):</span>
          <span>${(finalPrice * 0.1).toFixed(2)}</span>
        </div>
      </div>

      <form onSubmit={handlePaymentSubmit}>
        {/* Card Element */}
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#0F172A',
                  '::placeholder': {
                    color: '#64748B',
                  },
                },
                invalid: {
                  color: '#EF4444',
                },
              },
            }}
          />
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
          disabled={loading || !stripe || !elements}
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
