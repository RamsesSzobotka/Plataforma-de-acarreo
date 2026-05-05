import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useAuth } from '@clerk/clerk-react'
import { paymentsAPI, usersAPI } from '../services/api'

interface AddPaymentMethodProps {
  rideId?: string
  onSuccess?: (paymentMethodId: string) => void
}

export function AddPaymentMethod({ rideId, onSuccess }: AddPaymentMethodProps) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [savedMethodId, setSavedMethodId] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!stripe || !elements) {
      setError('Stripe no esta cargado correctamente')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element no encontrado')
      }

      const token = await getToken()
      const setupIntentResponse = await paymentsAPI.createSetupIntent(token || undefined)

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        setupIntentResponse.clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      )

      if (stripeError) {
        throw new Error(stripeError.message || 'Error al procesar la tarjeta')
      }

      if (!setupIntent || typeof setupIntent.payment_method !== 'string') {
        throw new Error('No se pudo confirmar el metodo de pago')
      }

      console.log('PaymentMethod confirmed:', setupIntent.payment_method)
      setSavedMethodId(setupIntent.payment_method)

      try {
        const attachResponse = await paymentsAPI.attachPaymentMethod(
          setupIntent.payment_method,
          setupIntentResponse.setupIntentId,
          token || undefined
        )
        console.log('PaymentMethod adjuntado:', attachResponse.brand, '****', attachResponse.last4)
      } catch (attachError) {
        const attachMessage = attachError instanceof Error ? attachError.message : 'Error desconocido'
        console.warn('Error adjuntando PaymentMethod (continuando):', attachMessage)
      }

      await usersAPI.savePaymentMethod(setupIntent.payment_method, token || undefined)
      console.log('Payment method saved to user profile')

      setSuccess(true)

      if (onSuccess) {
        onSuccess(setupIntent.payment_method)
      } else {
        const params = new URLSearchParams(window.location.search)
        const redirect = params.get('redirect')
        if (redirect === 'create-ride') {
          navigate('/create-ride?payment_added=true')
        } else if (rideId) {
          navigate(`/ride/${rideId}`)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <Link
        to="/my-rides"
        className="btn btn-ghost"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-6)',
          color: 'var(--text-muted)',
        }}
      >
        <span className="material-symbols-rounded">arrow_back</span>
        Volver a Mis Pedidos
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          marginBottom: 'var(--space-2)',
        }}>
          <span style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--primary-subtle)',
            color: 'var(--primary)',
            borderRadius: 'var(--radius)',
          }}>
            <span className="material-symbols-rounded">credit_card</span>
          </span>
          Agregar Metodo de Pago
        </h1>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
        }}>
          Guarda tu metodo de pago para usarlo en tus pedidos. Tu informacion se procesa de forma segura con Stripe.
        </p>
      </div>

      {/* Security badges */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-4)',
        justifyContent: 'center',
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-4)',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: 'var(--success)',
          fontSize: 'var(--text-sm)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>lock</span>
          <span>Encriptado</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>verified</span>
          <span>Stripe</span>
        </div>
      </div>

      {/* Card Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div
          className="card"
          style={{
            padding: 'var(--space-5)',
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <label style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-3)',
          }}>
            Informacion de la tarjeta
          </label>
          <div
            style={{
              padding: 'var(--space-4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-0)',
              transition: 'all var(--duration-fast) var(--ease-out)',
            }}
          >
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: 'var(--text-primary)',
                    '::placeholder': {
                      color: 'var(--text-muted)',
                    },
                  },
                  invalid: {
                    color: 'var(--error)',
                  },
                },
              }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--error-subtle)',
              color: 'var(--error)',
              borderRadius: 'var(--radius)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
            }}
          >
            <span className="material-symbols-rounded">error</span>
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--success-subtle)',
              color: 'var(--success)',
              borderRadius: 'var(--radius)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
            }}
          >
            <span className="material-symbols-rounded">check_circle</span>
            Metodo de pago guardado exitosamente!
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !stripe || !elements}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: '18px', height: '18px' }} />
              Guardando...
            </>
          ) : (
            <>
              <span className="material-symbols-rounded">save</span>
              Guardar Metodo de Pago
            </>
          )}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>info</span>
          Tu informacion de pago es procesada de forma segura por Stripe
        </div>
      </form>
    </div>
  )
}

export default AddPaymentMethod