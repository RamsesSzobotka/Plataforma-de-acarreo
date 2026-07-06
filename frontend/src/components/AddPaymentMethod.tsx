import { useState, useEffect, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  const [viewState, setViewState] = useState<ViewState>('loading')
  const [cardInfo, setCardInfo] = useState<{ brand: string; last4: string; expMonth: number; expYear: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [_savedMethodId, setSavedMethodId] = useState<string | null>(null)

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
      title: t('payment.deleteTitle'),
      text: t('payment.deleteText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#64748B',
      confirmButtonText: t('payment.deleteConfirm'),
      cancelButtonText: t('common.cancel'),
    })

    if (result.isConfirmed) {
      setLoading(true)
      try {
        const token = await getToken()
        await usersAPI.deletePaymentMethod(token || undefined)
        setCardInfo(null)
        setViewState('no_card')
      } catch (err) {
        const message = err instanceof Error ? err.message : t('common.error')
        setError(message)
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!stripe || !elements) {
      setError(t('payment.stripeNotReady'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error(t('payment.cardElementMissing'))
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
        throw new Error(stripeError.message || t('payment.cardProcessingError'))
      }

      if (!setupIntent || typeof setupIntent.payment_method !== 'string') {
        throw new Error(t('payment.methodConfirmationError'))
      }

      setSavedMethodId(setupIntent.payment_method)

      try {
        await paymentsAPI.attachPaymentMethod(
          setupIntent.payment_method,
          setupIntentResponse.setupIntentId,
          token || undefined
        )
      } catch (attachError) {
        const attachMessage = attachError instanceof Error ? attachError.message : t('common.error')
        console.warn('Error adjuntando PaymentMethod (continuando):', attachMessage)
      }

      await usersAPI.savePaymentMethod(setupIntent.payment_method, token || undefined)

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
      const message = err instanceof Error ? err.message : t('common.error')
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
        {t('payment.backToRides')}
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
          {t('payment.title')}
        </h1>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
        }}>
          {t('payment.instructions')}
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
          <span>{t('payment.encrypted')}</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>verified</span>
          <span>{t('payment.stripeLabel')}</span>
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
                  {t('payment.cardEndsWith', { brand: cardInfo.brand, last4: cardInfo.last4 })}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  {t('payment.expires', { month: cardInfo.expMonth, year: String(cardInfo.expYear).slice(-2) })}
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>check_circle</span>
                  {t('payment.active')}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button onClick={() => setViewState('form')} className="btn btn-primary" style={{ flex: 1 }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span>
              {t('payment.changeMethod')}
            </button>
            <button onClick={handleDelete} className="btn btn-danger" style={{ flex: 1 }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
              {t('common.delete')}
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
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-2)' }}>{t('payment.noMethod')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
            {t('payment.noMethodDesc')}
          </p>
          <button onClick={() => setViewState('form')} className="btn btn-primary">
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
            {t('payment.addMethod')}
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
              {t('payment.cardInfo')}
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
              {t('payment.savedSuccess')}
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
                {t('payment.saving')}
              </>
            ) : (
              <>
                <span className="material-symbols-rounded">save</span>
                {t('payment.saveButton')}
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
            {t('payment.stripeSecureInfo')}
          </div>
        </form>
      )}
    </div>
  )
}

export default AddPaymentMethod
