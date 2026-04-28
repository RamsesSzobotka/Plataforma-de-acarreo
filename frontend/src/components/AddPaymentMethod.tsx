import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { paymentsAPI, ridesAPI, usersAPI } from '../services/api'

interface AddPaymentMethodProps {
  rideId?: string
  onSuccess?: (paymentMethodId: string) => void
}

export function AddPaymentMethod({ rideId, onSuccess }: AddPaymentMethodProps) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [savedMethodId, setSavedMethodId] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!stripe || !elements) {
      setError('Stripe no está cargado correctamente')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element no encontrado')
      }

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      })

      if (stripeError) {
        throw new Error(stripeError.message || 'Error al procesar la tarjeta')
      }

      if (!paymentMethod) {
        throw new Error('No se pudo crear el método de pago')
      }

      console.log('✅ PaymentMethod created:', paymentMethod.id)
      setSavedMethodId(paymentMethod.id)

      // Guardar en perfil de usuario
      console.log('💾 Saving payment method to user profile...')
      await usersAPI.savePaymentMethod(paymentMethod.id)
      console.log('✅ Payment method saved to user profile')

      if (rideId) {
        console.log('💾 Saving payment method to ride...')
        await paymentsAPI.savePaymentMethod(rideId, paymentMethod.id)
        console.log('✅ Payment method saved to ride')
      }

      setSuccess(true)

      if (onSuccess) {
        onSuccess(paymentMethod.id)
      } else if (rideId) {
        navigate(`/ride/${rideId}`)
      } else {
        // Check if there's a redirect parameter
        const params = new URLSearchParams(window.location.search)
        const redirect = params.get('redirect')
        if (redirect === 'create-ride') {
          navigate('/create-ride?payment_added=true')
        }
      }

      setTimeout(() => {
        setSuccess(false)
      }, 5000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('❌ Error:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <Link 
        to="/my-rides" 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          marginBottom: '1.5rem',
          color: '#64748B',
          textDecoration: 'none',
        }}
      >
        <span className="material-symbols-rounded">arrow_back</span>
        Volver a Mis Pedidos
      </Link>

      <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">credit_card</span>
        Agregar Método de Pago
      </h1>

      <p style={{ color: '#64748B', marginBottom: '1.5rem' }}>
        Guarda tu método de pago para usarlo en tus pedidos. Tu información se procesa de forma segura con Stripe.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
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

        {error && (
          <div
            style={{
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

        {success && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#DCFCE7',
              color: '#166534',
              borderRadius: '6px',
              fontSize: '14px',
              border: '1px solid #BBF7D0',
            }}
          >
            ✅ ¡Método de pago guardado exitosamente!
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !stripe || !elements}
          className="btn btn-primary"
        >
          {loading ? '🔄 Guardando...' : '💳 Guardar Método de Pago'}
        </button>

        <div
          style={{
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

export default AddPaymentMethod