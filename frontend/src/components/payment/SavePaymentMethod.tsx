import { useState } from 'react'
import {
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardholderName, setCardholderName] = useState('')

  async function handleSavePaymentMethod(e: React.FormEvent) {
    e.preventDefault()

    if (!stripe || !elements) {
      setError(t('payment.stripeNotReady'))
      return
    }

    if (!cardholderName.trim()) {
      setError(t('payment.cardholderRequired'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error(t('payment.cardElementMissing'))
      }

      const { error: pmError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name: cardholderName,
          },
        })

      if (pmError) {
        throw new Error(pmError.message || t('payment.createMethodError'))
      }

      if (!paymentMethod) {
        throw new Error(t('payment.createMethodError'))
      }

      // Obtener últimos dígitos de la tarjeta
      const lastDigits =
        paymentMethod.card?.last4 || '****'
      const brand =
        paymentMethod.card?.brand || 'card'

      // Notificar al componente padre
      onPaymentMethodSaved(paymentMethod.id, `${brand.toUpperCase()} ****${lastDigits}`)

    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('common.error')
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
        {t('payment.saveTitle')}
      </h3>

      <p
        style={{
          marginBottom: '1rem',
          fontSize: '14px',
          color: '#64748B',
          lineHeight: '1.5',
        }}
      >
        {t('payment.instructions')}
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
            {t('payment.cardholderName')}
          </label>
          <input
            type="text"
            placeholder={t('payment.cardholderPlaceholder')}
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
            {t('payment.cardDetails')}
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
            {t('common.cancel')}
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
            {loading ? t('payment.saving') : t('payment.saveButton')}
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
