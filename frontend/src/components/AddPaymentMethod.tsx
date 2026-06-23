import { useState, useEffect, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useAuth } from '@clerk/clerk-react'
import { paymentsAPI, usersAPI } from '../services/api'
import Swal from 'sweetalert2'

interface AddPaymentMethodProps {
  rideId?: string
  onSuccess?: (paymentMethodId: string) => void
}

type ViewState = 'loading' | 'has_card' | 'no_card' | 'form'

export function AddPaymentMethod({ rideId, onSuccess }: AddPaymentMethodProps) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [viewState, setViewState] = useState<ViewState>('loading')
  const [cardInfo, setCardInfo] = useState<{ brand: string; last4: string; expMonth: number; expYear: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [savedMethodId, setSavedMethodId] = useState<string | null>(null)

  useEffect(() => {
    async function checkPaymentMethod() {
      try {
        const token = await getToken()
        const response = await usersAPI.getPaymentMethod(token || undefined)
        if (response.hasPaymentMethod && response.last4) {
          setCardInfo({
            brand: response.brand || '',
            last4: response.last4,
            expMonth: response.expMonth || 0,
            expYear: response.expYear || 0,
          })
          setViewState('has_card')
        } else {
          setViewState('no_card')
        }
      } catch {
        setViewState('no_card')
      }
    }
    checkPaymentMethod()
  }, [getToken])

  async function handleDelete() {
    const result = await Swal.fire({
      title: '¿Eliminar método de pago?',
      text: 'Esta acción no se puede deshacer. Deberás agregar uno nuevo para hacer pedidos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      setLoading(true)
      try {
        const token = await getToken()
        await usersAPI.deletePaymentMethod(token || undefined)
        setCardInfo(null)
        setViewState('no_card')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
  }

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

      const token2 = await getToken()
      const response = await usersAPI.getPaymentMethod(token2 || undefined)
      if (response.hasPaymentMethod && response.last4) {
        setCardInfo({
          brand: response.brand || '',
          last4: response.last4,
          expMonth: response.expMonth || 0,
          expYear: response.expYear || 0,
        })
        setViewState('has_card')
      }

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

  if (viewState === 'loading') {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    )
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
          Método de Pago
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

      {viewState === 'has_card' && cardInfo && (
        <>
          <div className="card" style={{
            padding: 'var(--space-6)',
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            marginBottom: 'var(--space-6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: 'var(--primary)' }}>credit_card</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-lg)' }}>
                  {cardInfo.brand} terminada en {cardInfo.last4}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Expira {cardInfo.expMonth}/{String(cardInfo.expYear).slice(-2)}
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>check_circle</span>
                  Activo
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button onClick={() => setViewState('form')} className="btn btn-primary" style={{ flex: 1 }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span>
              Cambiar método
            </button>
            <button onClick={handleDelete} className="btn btn-danger" style={{ flex: 1 }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
              Eliminar
            </button>
          </div>
        </>
      )}

      {viewState === 'no_card' && (
        <div className="card" style={{
          padding: 'var(--space-8)',
          textAlign: 'center',
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius)',
          marginBottom: 'var(--space-6)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>credit_card_off</span>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-2)' }}>No hay método de pago</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
            Agrega una tarjeta para poder solicitar pedidos
          </p>
          <button onClick={() => setViewState('form')} className="btn btn-primary">
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
            Agregar método de pago
          </button>
        </div>
      )}

      {viewState === 'form' && (
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
                      color: '#F8FAFC',
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
      )}
    </div>
  )
}

export default AddPaymentMethod
