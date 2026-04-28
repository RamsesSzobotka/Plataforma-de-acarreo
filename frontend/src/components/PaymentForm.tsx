import { useState } from 'react'
import { paymentsAPI } from '../services/api'

interface PaymentFormProps {
  ride: any
  onPaymentSuccess: (updatedRide: any) => void
  onPaymentError: (error: string) => void
}

export function PaymentForm({
  ride,
  onPaymentSuccess,
  onPaymentError,
}: PaymentFormProps) {
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

  async function handlePaymentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setLoading(true)
    setError(null)

    try {
      console.log('📱 Processing payment...')
      
      // Usar pago simulado
      const result = await paymentsAPI.confirmPaymentSimulated(ride._id)
      
      console.log('✅ Payment succeeded:', result)
      
      setSuccess(true)
      onPaymentSuccess(result.ride)

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
        {/* Info message for demo */}
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#FEF3C7',
            color: '#92400E',
            borderRadius: '6px',
            fontSize: '13px',
            border: '1px solid #FCD34D',
          }}
        >
          💡 Modo demo: Este pago es simulado. No se procesará con Stripe real.
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
        >
          {loading ? '🔄 Procesando...' : `💳 Pagar $${finalPrice.toFixed(2)}`}
        </button>
      </form>
    </div>
  )
}