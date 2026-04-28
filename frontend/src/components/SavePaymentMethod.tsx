import { useState } from 'react'
import {
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { Stripe, StripeElements, PaymentMethod } from '@stripe/stripe-js'

interface SavePaymentMethodProps {
  onPaymentMethodSaved: (paymentMethodId: string, lastDigits: string) => void
  onError: (error: string) => void
  onCancel: () => void
}

export function SavePaymentMethod({
  onPaymentMethodSaved,
  onError,
  onCancel,
}: SavePaymentMethodProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardholderName, setCardholderName] = useState('')

  async function handleSavePaymentMethod(e: React.FormEvent) {
    e.preventDefault()

    if (!stripe || !elements) {
      setError('Stripe no está cargado correctamente')
      return
    }

    if (!cardholderName.trim()) {
      setError('Por favor ingresa el nombre del titular')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element no encontrado')
      }

      // Crear Payment Method en Stripe
      console.log('💳 Creando Payment Method en Stripe...')
      const { error: pmError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name: cardholderName,
          },
        })

      if (pmError) {
        throw new Error(pmError.message || 'Error al crear el método de pago')
      }

      if (!paymentMethod) {
        throw new Error('No se pudo crear el método de pago')
      }

      console.log('✅ Payment Method creado:', paymentMethod.id)

      // Obtener últimos dígitos de la tarjeta
      const lastDigits =
        paymentMethod.card?.last4 || '****'
      const brand =
        paymentMethod.card?.brand || 'card'

      // Notificar al componente padre
      onPaymentMethodSaved(paymentMethod.id, `${brand.toUpperCase()} ****${lastDigits}`)

      console.log(
        `💾 Método de pago guardado: ${brand} ****${lastDigits}`
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido'
      console.error('❌ Error:', message)
      setError(message)
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: '#F8FAFC',
        borderRadius: '12px',
        border: '2px solid #E2E8F0',
      }}
    >
      <h3
        style={{
          margin: '0 0 1rem 0',
          fontSize: '18px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span className="material-symbols-rounded">credit_card</span>
        Guardar Forma de Pago
      </h3>

      <p
        style={{
          marginBottom: '1rem',
          fontSize: '14px',
          color: '#64748B',
          lineHeight: '1.5',
        }}
      >
        ⚠️ Es obligatorio guardar una forma de pago para crear el pedido. Se cobrará
        automáticamente cuando el conductor confirme la entrega.
      </p>

      <form onSubmit={handleSavePaymentMethod}>
        {/* Cardholder Name */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            Nombre del Titular *
          </label>
          <input
            type="text"
            placeholder="Ej: Juan Pérez"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '16px',
              fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box',
            }}
            required
          />
        </div>

        {/* Card Element */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            Datos de la Tarjeta *
          </label>
          <div
            style={{
              padding: '0.75rem',
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

        {/* Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '0.875rem',
              backgroundColor: '#E2E8F0',
              color: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading || !stripe || !elements}
            style={{
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
          >
            {loading ? '🔄 Guardando...' : '✓ Guardar Forma de Pago'}
          </button>
        </div>

        {/* Security info */}
        <div
          style={{
            marginTop: '1rem',
            fontSize: '12px',
            color: '#64748B',
            textAlign: 'center',
          }}
        >
          🔒 Tu información de pago es procesada de forma segura por Stripe
        </div>
      </form>
    </div>
  )
}
