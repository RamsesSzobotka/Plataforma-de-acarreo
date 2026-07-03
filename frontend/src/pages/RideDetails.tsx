import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { PaymentForm } from '../components/PaymentForm'
import { ridesAPI, usersAPI, ratingsAPI } from '../services/api'
import { wsService } from '../services/api'
import { StatusBadge } from '../components/StatusBadge'
import { TimelineStepper } from '../components/TimelineStepper'
import type { DriverContact, RatingWithRater } from '../types'
import type { Ride } from '../types'
import { useNotifications } from '../contexts/NotificationsContext'
import { showConfirm, showError, showSuccess } from '../services/alerts'
import { useRideTracking } from '../hooks/useRideTracking'
import RouteMapWrapper from '../components/RouteMapWrapper'
import DriverProfilePopup from '../components/DriverProfilePopup'
import { useTranslation } from 'react-i18next'

interface Driver {
  _id: string
  userId: string
  vehicleType: string
  plate: string
  rating: number
  totalRides: number
}

interface User {
  _id: string
  clerkId: string
  firstName?: string
  lastName?: string
  imageUrl?: string
}

function RideDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const { getToken } = useAuth()
  const { unreadCounts } = useNotifications()
  const { t, i18n } = useTranslation()
  const [ride, setRide] = useState<Ride | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [driverUser, setDriverUser] = useState<User | null>(null)
  const [contacts, setContacts] = useState<DriverContact[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [driverPopup, setDriverPopup] = useState<{ driverUser: any; driver: any; rideId?: string; position: { x: number; y: number } } | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [existingRating, setExistingRating] = useState<RatingWithRater | null>(null)
  const [hasRated, setHasRated] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [userHasPaymentMethod, setUserHasPaymentMethod] = useState(false)
  const [driverRating, setDriverRating] = useState(0)
  const [driverComment, setDriverComment] = useState('')
  const [driverExistingRating, setDriverExistingRating] = useState<RatingWithRater | null>(null)
  const [driverHasRated, setDriverHasRated] = useState(false)

  // ── Tracking en vivo del conductor ──
  const { driverLocation, isTracking } = useRideTracking({
    rideId: id ?? '',
    rideStatus: ride?.status ?? '',
    getToken: async () => (await getToken()) ?? '',
  })

  // Verificar método de pago actual del usuario (no el del ride, que puede estar desactualizado)
  useEffect(() => {
    async function checkUserPaymentMethod() {
      try {
        const token = await getToken()
        if (!token) return
        const result = await usersAPI.getPaymentMethod(token)
        setUserHasPaymentMethod(result.hasPaymentMethod)
      } catch {
        setUserHasPaymentMethod(false)
      }
    }
    checkUserPaymentMethod()
  }, [getToken])

  // Verificar si el usuario ya ha calificado este acarreo
  useEffect(() => {
    async function checkExistingRating() {
      if (!ride || ride.status !== 'paid' || !user?.id) return
      
      const isClient = ride.clientId === user.id
      const isDriver = ride.driverId === user.id
      if (!isClient && !isDriver) return

      try {
        const token = await getToken()
        if (!token) return

        const response = await ratingsAPI.getRideRatings(ride._id, token)
        const userRating = response.ratings.find((r) => r.raterId === user.id)

        if (isClient) {
          if (userRating) {
            setExistingRating(userRating)
            setHasRated(true)
          } else {
            setExistingRating(null)
            setHasRated(false)
          }
        } else {
          if (userRating) {
            setDriverExistingRating(userRating)
            setDriverHasRated(true)
          } else {
            setDriverExistingRating(null)
            setDriverHasRated(false)
          }
        }
      } catch (err) {
        console.error('Error checking existing rating:', err)
        if (isClient) {
          setHasRated(false)
        } else {
          setDriverHasRated(false)
        }
      }
    }

    checkExistingRating()
  }, [ride, user, getToken])

  useEffect(() => {
    if (!id || !user) return
    loadRide()
  }, [id, user, getToken])

  async function loadDriverData(driverId: string) {
    try {
      const token = await getToken()
      if (!token) return

      const driverData = await usersAPI.get(driverId, token)
      setDriverUser(driverData)

      const driverProfile = await usersAPI.getDriver(driverId, token)
      setDriver(driverProfile)
    } catch (err) {
      console.error('Error loading driver data:', err)
    }
  }

  async function loadRide() {
    if (!id) {
      setLoading(false)
      return
    }

    try {
      const token = await getToken()
      if (!token) {
        console.warn('No token available yet, skipping loadRide')
        setLoading(false)
        return
      }
      const data = await ridesAPI.get(id, token)
      setRide(data)

      if (data.driverId) {
        const driverData = await usersAPI.get(data.driverId, token)
        setDriverUser(driverData)

        const driverProfile = await usersAPI.getDriver(data.driverId, token)
        setDriver(driverProfile)
      }

      if (data.status === 'requested' && user?.id === data.clientId) {
        const contactsResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${id}/contacts`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json()
          setContacts(contactsData.data || [])
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  // Conectar WebSocket para recibir eventos en vivo del ride
  useEffect(() => {
    if (!id || !user) return

    let isCancelled = false

    ;(async () => {
      const token = await getToken()
      if (token && !isCancelled) {
        wsService.connect(id, token)
      }
    })()

    const unsubscribe = wsService.onMessage((data) => {
      if (isCancelled) return

      const eventRideId = data.data?.rideId || data.data?._id || data.rideId

      if (eventRideId === id || data.type === 'ride_status_changed') {
        switch (data.type) {
          case 'ride_status_changed': {
            const { newStatus, ride: updatedRide } = data.data || {}
            if (newStatus) {
              setRide(prev => prev ? {
                ...prev,
                status: newStatus,
                ...(updatedRide?.driverId ? { driverId: updatedRide.driverId } : {}),
                ...(updatedRide?.finalPrice ? { finalPrice: updatedRide.finalPrice } : {}),
                ...(updatedRide?.deliveryPhoto ? { deliveryPhoto: updatedRide.deliveryPhoto } : {}),
              } : prev)

              if (updatedRide?.driverId && !ride?.driverId) {
                loadDriverData(updatedRide.driverId)
              }
            }
            break
          }

          case 'new_message':
            break

          case 'price_proposed':
          case 'price_accepted':
          case 'price_rejected':
            break

          default:
            loadRide()
        }
      }
    })

    return () => {
      isCancelled = true
      unsubscribe()
      wsService.disconnect()
    }
  }, [id, user])

  // Polling cada 15s como fallback si WS no está disponible
  useEffect(() => {
    if (!id) return
    const interval = setInterval(loadRide, 30000)
    return () => clearInterval(interval)
  }, [id])

  async function handleCancel() {
    if (!id) return
    const confirmed = await showConfirm({
      title: t('ride.detail.cancelConfirmTitle'),
      text: t('ride.detail.cancelConfirmText'),
      icon: 'warning',
      confirmText: t('ride.detail.cancelConfirmBtn')
    })

    if (!confirmed) return

    try {
      const token = await getToken()
      await ridesAPI.cancel(id, 'Cancelado por el cliente', token || undefined)
      loadRide()
    } catch {
    }
  }

  async function handleConfirmDelivery() {
    if (!user || !ride || !id) return

    const confirmMessage = userHasPaymentMethod
      ? t('ride.detail.confirmDeliveryWithPayment')
      : t('ride.detail.confirmDeliveryWithoutPayment')

    const confirmed = await showConfirm({
      title: t('ride.detail.confirmDelivery'),
      text: confirmMessage
    })

    if (!confirmed) return

    try {
      const token = await getToken()
      if (!token) throw new Error(t('auth.sessionInvalid'))

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${id}/confirm-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t('ride.detail.confirmDeliveryError'))
      }

      const result = await response.json()

      if (result.message?.includes('pagado')) {
        await showSuccess(t('ride.detail.confirmDeliverySuccessPaid'))
      } else {
        await showSuccess(t('ride.detail.confirmDeliverySuccess'))
      }

      loadRide()
    } catch (error) {
      await showError(error instanceof Error ? error.message : t('ride.detail.confirmDeliveryError'))
    }
  }

  async function handlePaymentSuccess(updatedRide: Ride) {
    setRide(updatedRide)
    setShowPaymentForm(false)
    setTimeout(() => loadRide(), 2000)
  }

  async function handlePaymentError(error: string) {
    setPaymentError(error)
  }

  async function handleRate() {
    if (!ride || rating === 0 || !user || !id) return
    try {
      const token = await getToken()
      if (!token) throw new Error(t('auth.sessionInvalid'))
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          comment,
          raterId: user.id,
        }),
      })
      if (response.ok) {
        await showSuccess(t('ride.detail.ratingSent'))
        setRating(0)
        setComment('')
        loadRide()
      } else if (response.status === 409) {
        // Intento de duplicar calificación — el backend rechaza correctamente
        const data = await response.json()
        await showError(data.error || t('ride.detail.ratingAlreadyRated'))
      } else {
        await showError(t('ride.detail.ratingError'))
      }
    } catch (err) {
      await showError((err as Error).message || t('ride.detail.ratingError'))
    }
  }

  async function handleDriverRate() {
    if (!ride || driverRating === 0 || !user || !id) return
    try {
      const token = await getToken()
      if (!token) throw new Error(t('auth.sessionInvalid'))
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: driverRating,
          comment: driverComment,
          raterId: user.id,
        }),
      })
      if (response.ok) {
        await showSuccess(t('ride.detail.ratingSent'))
        setDriverRating(0)
        setDriverComment('')
        loadRide()
      } else if (response.status === 409) {
        const data = await response.json()
        await showError(data.error || t('ride.detail.ratingAlreadyRated'))
      } else {
        await showError(t('ride.detail.ratingError'))
      }
    } catch (err) {
      await showError((err as Error).message || t('ride.detail.ratingError'))
    }
  }

  const handleContactClick = (contact: DriverContact, e: React.MouseEvent) => {
    const driverData = {
      clerkId: contact.driverId,
      firstName: contact.driver?.firstName,
      lastName: contact.driver?.lastName,
      imageUrl: contact.driver?.imageUrl,
    }
    setDriverPopup({
      driverUser: driverData,
      driver: null,
      rideId: `${id}?contactId=${contact._id}&driverId=${contact.driverId}`,
      position: { x: e.clientX, y: e.clientY },
    })
  }

  if (loading) {
    return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 var(--space-4)' }}>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    )
  }

  if (!ride) return <div>{t('ride.detail.noRideFound')}</div>

  const isClientOwner = user?.id === ride.clientId
  const isDriverOwner = user?.id === ride.driverId
  const isOwner = isClientOwner
  const canClientCancel = isClientOwner && ride.status === 'requested'
  const canDriverCancel = isDriverOwner && ride.status === 'accepted'

  const unreadCount = unreadCounts[ride._id] || 0

  const timelineSteps = [
    { status: 'requested', label: t('ride.status.requested') },
    { status: 'accepted', label: t('ride.status.accepted') },
    { status: 'in_progress', label: t('ride.status.in_progress') },
    { status: 'completed', label: t('ride.status.completed') },
    { status: 'paid', label: t('ride.status.paid') },
  ]

  const typeLabels: Record<string, string> = {
    mudanza: t('ride.type.mudanza'),
    electrodomesticos: t('ride.type.electrodomesticos'),
    muebles: t('ride.type.muebles'),
    productos: t('ride.type.productos'),
    otros: t('ride.type.otros'),
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 var(--space-4)' }}>
      {/* Back button */}
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
        {t('ride.detail.backToMyRides')}
      </Link>

      {/* Hero Section with Status */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--space-6)',
          padding: 0,
          overflow: 'hidden',
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
        }}
      >
        {/* Header with gradient */}
        <div style={{
          background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'relative',
        }}>
          {/* Unread badge */}
          {unreadCount > 0 && (isClientOwner || isDriverOwner) && (
            <div
              style={{
                position: 'absolute',
                top: 'var(--space-4)',
                right: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-1) var(--space-3)',
                background: 'var(--error)',
                color: 'white',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-bold)',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>chat</span>
              {unreadCount > 99 ? '99+' : unreadCount} mensajes
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', paddingRight: unreadCount > 0 ? '220px' : '140px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-1) var(--space-3)',
                  background: 'var(--surface-3)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>category</span>
                  {typeLabels[ride.type] || ride.type}
                </span>
              </div>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--font-bold)',
                marginBottom: 'var(--space-2)',
              }}>
                {ride.title}
              </h1>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {ride.description}
              </p>
            </div>
          </div>

          {/* Status Badge - posicionado arriba a la derecha, separado del unread badge */}
          <div style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: unreadCount > 0 ? 'calc(var(--space-4) + 120px)' : 'var(--space-4)',
            zIndex: 10,
          }}>
            <StatusBadge status={ride.status} size="lg" />
          </div>
        </div>

        {/* Timeline */}
        <div style={{ padding: 'var(--space-6)' }}>
          <TimelineStepper
            steps={timelineSteps}
            currentStatus={ride.status}
            orientation={window.innerWidth < 640 ? 'vertical' : 'horizontal'}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--space-6)',
      }}>
        {/* Left Column - Images & Locations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Images */}
          {ride.images && ride.images.length > 0 && (
            <div
              className="card"
              style={{
                animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                animationDelay: '100ms',
                animationFillMode: 'both',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  borderRadius: 'var(--radius)',
                }}>
                  <span className="material-symbols-rounded">photo_library</span>
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    margin: 0,
                  }}>
                    {t('ride.detail.images')}
                  </h3>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {ride.images.length} imagen{ride.images.length !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: ride.images.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                {ride.images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImage(img.url)}
                    style={{
                      position: 'relative',
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      aspectRatio: '4/3',
                      background: 'var(--surface-1)',
                      transition: 'transform var(--duration-fast) var(--ease-out)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <img
                      src={img.url}
                      alt={`Imagen ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locations */}
          <div
            className="card"
            style={{
              animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
              animationDelay: '150ms',
              animationFillMode: 'both',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-5)',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--info-subtle)',
                color: 'var(--info)',
                borderRadius: 'var(--radius)',
              }}>
                <span className="material-symbols-rounded">map</span>
              </div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                margin: 0,
              }}>
                {t('ride.detail.locations')}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Pickup */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: 'var(--success-subtle)',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--success)',
                  color: 'white',
                  borderRadius: '50%',
                  flexShrink: 0,
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>circle</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--success)',
                    fontWeight: 'var(--font-semibold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {t('ride.detail.pickup')}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}>
                    {ride.pickupLocation.address}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-1) 0' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  borderRadius: '50%',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>south</span>
                </div>
              </div>

              {/* Dropoff */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: 'var(--error-subtle)',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--error)',
                  color: 'white',
                  borderRadius: '50%',
                  flexShrink: 0,
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>location_on</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--error)',
                    fontWeight: 'var(--font-semibold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {t('ride.detail.dropoff')}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}>
                    {ride.dropoffLocation.address}
                  </div>
                </div>
              </div>
            </div>

            {/* Route Map */}
            {ride.pickupLocation?.coordinates && ride.dropoffLocation?.coordinates && (
              <div style={{ marginTop: '1rem' }}>
                <RouteMapWrapper
                  pickup={{
                    address: ride.pickupLocation.address,
                    coordinates: {
                      lat: ride.pickupLocation.coordinates[1],
                      lng: ride.pickupLocation.coordinates[0],
                    },
                  }}
                  dropoff={{
                    address: ride.dropoffLocation.address,
                    coordinates: {
                      lat: ride.dropoffLocation.coordinates[1],
                      lng: ride.dropoffLocation.coordinates[0],
                    },
                  }}
                  driverLocation={driverLocation}
                />
                {/* Tracking active badge */}
                {isTracking && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: 'var(--success-subtle)',
                    borderRadius: 'var(--radius)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--success)',
                    fontWeight: 'var(--font-medium)',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                      my_location
                    </span>
                    {t('ride.detail.liveDriverLocation')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delivery Photo */}
          {ride.deliveryPhoto && (
            <div
              className="card"
              style={{
                animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                animationDelay: '200ms',
                animationFillMode: 'both',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--secondary)',
                  color: 'white',
                  borderRadius: 'var(--radius)',
                }}>
                  <span className="material-symbols-rounded">photo_camera</span>
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    margin: 0,
                  }}>
                    {t('ride.detail.deliveryPhoto')}
                  </h3>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Confirmacion visual del servicio
                  </span>
                </div>
              </div>

              <div style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
              }}>
                <img
                  src={ride.deliveryPhoto.url}
                  alt="Entrega"
                  style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    objectFit: 'cover',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Driver/Contacts & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Driver Info or Contacts */}
          {(ride.status === 'accepted' || ride.status === 'in_progress' || ride.status === 'completed' || ride.status === 'paid' || ride.status === 'failed') && driverUser && driver ? (
            <div
              className="card"
              style={{
                animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                animationDelay: '100ms',
                animationFillMode: 'both',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  borderRadius: 'var(--radius)',
                }}>
                  <span className="material-symbols-rounded">person</span>
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    margin: 0,
                  }}>
                    {t('ride.detail.assignedDriver')}
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {driverUser.imageUrl ? (
                  <img
                    src={driverUser.imageUrl}
                    alt={driverUser.firstName}
                    onClick={(e) => setDriverPopup({
                      driverUser,
                      driver,
                      rideId: ride?._id,
                      position: { x: e.clientX, y: e.clientY },
                    })}
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid var(--primary-subtle)',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    />
                  ) : (
                    <div
                      onClick={(e) => setDriverPopup({
                      driverUser,
                      driver,
                      rideId: ride?._id,
                      position: { x: e.clientX, y: e.clientY },
                    })}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-xl)',
                      fontWeight: 'var(--font-bold)',
                      border: '3px solid var(--primary-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {driverUser.firstName?.charAt(0) || 'D'}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {driverUser.firstName} {driverUser.lastName}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--warning)' }}>
                        star
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{driver.rating}</strong>
                      ({driver.totalRides} viajes)
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    flexWrap: 'wrap',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>local_shipping</span>
                    {driver.vehicleType} - {driver.plate}
                  </div>
                </div>
              </div>

              {isClientOwner && (
                <Link
                  to={`/chat/${ride._id}?contactId=${ride.driverId}&driverId=${ride.driverId}`}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    marginTop: 'var(--space-4)',
                  }}
                >
                  <span className="material-symbols-rounded">chat</span>
                  {t('ride.detail.chatWithDriver')}
                </Link>
              )}

              {isDriverOwner && (
                <Link
                  to={`/chat/${ride._id}`}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    marginTop: 'var(--space-4)',
                  }}
                >
                  <span className="material-symbols-rounded">chat</span>
                  {t('ride.detail.chatWithClient')}
                </Link>
              )}
            </div>
          ) : isClientOwner && contacts.length > 0 && (
            <div
              className="card"
              style={{
                animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                animationDelay: '100ms',
                animationFillMode: 'both',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--warning-subtle)',
                  color: 'var(--warning)',
                  borderRadius: 'var(--radius)',
                }}>
                  <span className="material-symbols-rounded">chat</span>
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    margin: 0,
                  }}>
                    Conductores Interesados
                  </h3>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {contacts.length} conductor{contacts.length !== 1 ? 'es' : ''} te ha escrito
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                {contacts.map((contact) => (
                  <div
                    key={contact._id}
                    onClick={(e) => handleContactClick(contact, e)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      cursor: 'pointer',
                      padding: 'var(--space-4)',
                      background: 'var(--surface-1)',
                      borderRadius: 'var(--radius)',
                      border: '2px solid transparent',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                      minWidth: '80px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)'
                      e.currentTarget.style.background = 'var(--primary-subtle)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'transparent'
                      e.currentTarget.style.background = 'var(--surface-1)'
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '2px solid var(--primary)',
                        }}
                      >
                        {contact.driver?.imageUrl ? (
                          <img
                            src={contact.driver.imageUrl}
                            alt={`${contact.driver.firstName} ${contact.driver.lastName}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                            background: 'var(--primary)',
                            color: 'white',
                            fontSize: 'var(--text-lg)',
                            fontWeight: 'var(--font-bold)',
                          }}>
                            {contact.driver?.firstName?.charAt(0) || 'D'}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '0',
                          right: '0',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: 'var(--success)',
                          border: '2px solid var(--surface-card)',
                        }}
                      />
                    </div>
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      color: 'var(--text-primary)',
                    }}>
                      {contact.driver?.firstName || 'Driver'}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{
                marginTop: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}>
                Haz click en un conductor para iniciar conversacion
              </p>
            </div>
          )}

          {/* Price & Actions Card */}
          <div
            className="card"
            style={{
              animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
              animationDelay: '200ms',
              animationFillMode: 'both',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-5)',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--secondary)',
                color: 'white',
                borderRadius: 'var(--radius)',
              }}>
                <span className="material-symbols-rounded">payments</span>
              </div>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-semibold)',
                  margin: 0,
                }}>
                  {t('ride.detail.paymentSummary')}
                </h3>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-5)',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-1)',
                }}>
                  {ride.finalPrice ? t('ride.detail.finalPrice') : t('ride.detail.estimatedPrice')}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'clamp(1.5rem, 4vw, var(--text-3xl))',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--secondary)',
                }}>
                  ${(ride.finalPrice || ride.estimatedPrice).toLocaleString()}
                </div>
              </div>
              {ride.finalPrice && ride.finalPrice !== ride.estimatedPrice && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--success-subtle)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--success)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>done</span>
                  {t('ride.detail.negotiatedPrice')}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {(canClientCancel || canDriverCancel) && (
                <button
                  className="btn btn-outline"
                  onClick={handleCancel}
                  style={{
                    width: '100%',
                    borderColor: 'var(--error)',
                    color: 'var(--error)',
                  }}
                >
                  <span className="material-symbols-rounded">cancel</span>
                  {t('ride.detail.cancel')}
                </button>
              )}

              {ride.status === 'in_progress' && isClientOwner && (
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmDelivery}
                  style={{ width: '100%' }}
                >
                  <span className="material-symbols-rounded">check_circle</span>
                  {t('ride.detail.confirmDelivery')}
                </button>
              )}

              {ride.status === 'completed' && isClientOwner && !userHasPaymentMethod && !showPaymentForm && (
                <Link
                  to={`/add-payment-method?rideId=${ride._id}`}
                  className="btn btn-secondary"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  <span className="material-symbols-rounded">credit_card</span>
                  {t('ride.detail.addPaymentMethod')}
                </Link>
              )}

              {ride.status === 'completed' && isClientOwner && userHasPaymentMethod && !showPaymentForm && (
                <button
                  className="btn btn-accent"
                  onClick={() => setShowPaymentForm(true)}
                  style={{ width: '100%' }}
                >
                  <span className="material-symbols-rounded">payment</span>
                  {t('ride.detail.payNow', { amount: (ride.finalPrice || ride.estimatedPrice).toLocaleString() })}
                </button>
              )}

              {(ride.status === 'paid' || ride.paidAt) && isClientOwner && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-4)',
                  background: 'var(--success-subtle)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--success)',
                  fontWeight: 'var(--font-semibold)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>check_circle</span>
                  {t('ride.detail.paymentConfirmed')}
                </div>
              )}
            </div>

            {/* Payment Form */}
            {showPaymentForm && ride.status === 'completed' && isClientOwner && (
              <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border-subtle)' }}>
                {paymentError && (
                  <div style={{
                    marginBottom: 'var(--space-4)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--error-subtle)',
                    color: 'var(--error)',
                    borderRadius: 'var(--radius)',
                    fontSize: 'var(--text-sm)',
                  }}>
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
                  className="btn btn-ghost"
                  style={{ width: '100%', marginTop: 'var(--space-3)' }}
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Info notifications */}
            {ride.status === 'completed' && isClientOwner && userHasPaymentMethod && !ride.paidAt && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: 'var(--info-subtle)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-start',
              }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--info)', flexShrink: 0 }}>
                  info
                </span>
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <strong style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Pago Automatico</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Se cobrara automaticamente ${(ride.finalPrice || ride.estimatedPrice).toLocaleString()} a tu forma de pago guardada.
                  </span>
                </div>
              </div>
            )}

            {ride.status === 'completed' && isClientOwner && !userHasPaymentMethod && !ride.paidAt && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: 'var(--warning-subtle)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-start',
              }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--warning)', flexShrink: 0 }}>
                  warning
                </span>
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <strong style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Metodo de Pago Requerido</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {t('ride.detail.paymentRequired')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Rating */}
          {ride.status === 'paid' && isOwner && (
            <div
              className="card"
              style={{
                animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                animationDelay: '250ms',
                animationFillMode: 'both',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: hasRated ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                  color: hasRated ? 'var(--success)' : 'var(--warning)',
                  borderRadius: 'var(--radius)',
                }}>
                  <span className="material-symbols-rounded">{hasRated ? 'check_circle' : 'star'}</span>
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    margin: 0,
                  }}>
                    {hasRated ? t('ride.detail.yourRating') : t('ride.detail.rateService')}
                  </h3>
                  {hasRated && (
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--success)',
                      fontWeight: 'var(--font-medium)',
                    }}>
                      {t('ride.detail.alreadyRated')}
                    </span>
                  )}
                </div>
              </div>

              {hasRated && existingRating ? (
                /* Mostrar calificacion existente */
                <div>
                  {/* Stars display */}
                  <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className="material-symbols-rounded"
                        style={{
                          fontSize: '1.75rem',
                          color: existingRating.rating >= star ? 'var(--warning)' : 'var(--surface-3)',
                        }}
                      >
                        star
                      </span>
                    ))}
                  </div>

                  {/* Comment */}
                  {existingRating.comment && (
                    <p style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      marginBottom: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      "{existingRating.comment}"
                    </p>
                  )}

                  {/* Rated date */}
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                  }}>
                    {t('ride.detail.ratedOn')} {new Date(existingRating.createdAt).toLocaleDateString(i18n.language || 'en', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              ) : (
                /* Formulario de calificacion */
                <>
                  {/* Star rating */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 'var(--space-1)',
                          cursor: 'pointer',
                          transition: 'transform var(--duration-fast) var(--ease-out)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <span
                          className="material-symbols-rounded"
                          style={{
                            fontSize: '2rem',
                            color: rating >= star ? 'var(--warning)' : 'var(--surface-3)',
                            transition: 'color var(--duration-fast)',
                          }}
                        >
                          star
                        </span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="input"
                    placeholder={t('ride.detail.commentPlaceholder')}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={{ marginBottom: 'var(--space-4)' }}
                  />

                  <button
                    onClick={handleRate}
                    disabled={rating === 0}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    <span className="material-symbols-rounded">send</span>
                    {t('ride.detail.submitRating')}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Driver Rating */}
          {ride.status === 'paid' && isDriverOwner && (
            <div
              className="card"
              style={{
                animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                animationDelay: '300ms',
                animationFillMode: 'both',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: driverHasRated ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                  color: driverHasRated ? 'var(--success)' : 'var(--warning)',
                  borderRadius: 'var(--radius)',
                }}>
                  <span className="material-symbols-rounded">{driverHasRated ? 'check_circle' : 'star'}</span>
                </div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    margin: 0,
                  }}>
                    {driverHasRated ? t('ride.detail.yourRating') : t('ride.detail.rateClient')}
                  </h3>
                  {driverHasRated && (
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--success)',
                      fontWeight: 'var(--font-medium)',
                    }}>
                      {t('ride.detail.alreadyRated')}
                    </span>
                  )}
                </div>
              </div>

              {driverHasRated && driverExistingRating ? (
                /* Mostrar calificacion existente */
                <div>
                  {/* Stars display */}
                  <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className="material-symbols-rounded"
                        style={{
                          fontSize: '1.75rem',
                          color: driverExistingRating.rating >= star ? 'var(--warning)' : 'var(--surface-3)',
                        }}
                      >
                        star
                      </span>
                    ))}
                  </div>

                  {/* Comment */}
                  {driverExistingRating.comment && (
                    <p style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      marginBottom: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      "{driverExistingRating.comment}"
                    </p>
                  )}

                  {/* Rated date */}
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                  }}>
                    {t('ride.detail.ratedOn')} {new Date(driverExistingRating.createdAt).toLocaleDateString(i18n.language || 'en', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              ) : (
                /* Formulario de calificacion */
                <>
                  {/* Star rating */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setDriverRating(star)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 'var(--space-1)',
                          cursor: 'pointer',
                          transition: 'transform var(--duration-fast) var(--ease-out)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <span
                          className="material-symbols-rounded"
                          style={{
                            fontSize: '2rem',
                            color: driverRating >= star ? 'var(--warning)' : 'var(--surface-3)',
                            transition: 'color var(--duration-fast)',
                          }}
                        >
                          star
                        </span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="input"
                    placeholder={t('ride.detail.commentPlaceholder')}
                    value={driverComment}
                    onChange={(e) => setDriverComment(e.target.value)}
                    style={{ marginBottom: 'var(--space-4)' }}
                  />

                  <button
                    onClick={handleDriverRate}
                    disabled={driverRating === 0}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    <span className="material-symbols-rounded">send</span>
                    {t('ride.detail.submitRating')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-6)',
            cursor: 'pointer',
            animation: 'fadeIn var(--duration-fast) var(--ease-out)',
          }}
        >
          <button
            onClick={() => setSelectedImage(null)}
            style={{
              position: 'absolute',
              top: 'var(--space-6)',
              right: 'var(--space-6)',
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <span className="material-symbols-rounded">close</span>
          </button>
          <img
            src={selectedImage}
            alt="Imagen enlarged"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-lg)',
              animation: 'scaleIn var(--duration-normal) var(--ease-out)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Driver Profile Popup */}
      {driverPopup && (
        <DriverProfilePopup
          driverUser={driverPopup.driverUser}
          driver={driverPopup.driver}
          rideId={driverPopup.rideId}
          position={driverPopup.position}
          onClose={() => setDriverPopup(null)}
        />
      )}
    </div>
  )
}

export default RideDetails