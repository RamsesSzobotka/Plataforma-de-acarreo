import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import ChatButton from '../components/ride/ChatButton'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import type { Ride } from '../types'
import { ridesAPI, usersAPI, paymentsAPI, userWsService } from '../services/api'
// ponytail: dynamic import to split sweetalert2 chunk
import { useDriverLocation } from '../hooks/useDriverLocation'
import { useTranslation } from 'react-i18next'
import RideMapModal from '../components/map/RideMapModal'

interface Driver {
  _id: string
  verificationStatus: string
  rejectionReason?: string
  phone?: string
  vehicleType?: string
  plate?: string
  rating?: number
  totalRides?: number
  isAvailable?: boolean
  stripeAccountId?: string
  payoutsEnabled?: boolean
}

function DriverDashboard() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableRides, setAvailableRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'available' | 'mine'>('available')
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [mineFilter, setMineFilter] = useState<string>('all')
  const [driverLocation, setDriverLocation] = useState<{lat: number; lng: number} | null>(null)
  const filteredMyRides = useMemo(() => {
    return myRides.filter(ride => {
      if (mineFilter === 'all') return true
      if (mineFilter === 'pending') return ['requested', 'negotiating', 'accepted'].includes(ride.status)
      return ride.status === mineFilter
    })
  }, [myRides, mineFilter])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showMapModal, setShowMapModal] = useState(false)

  function handleRideNavigate(rideId: string) {
    setShowMapModal(false)
    navigate(`/ride/${rideId}`)
  }

  // ── Tracking automático cuando hay un viaje activo ──
  const activeRide = myRides.find(r => r.status === 'in_progress')
  const trackingRideId = activeRide?._id ?? ''
  const trackingRideStatus = activeRide?.status ?? ''
  const { isSharing: isTrackingActive, error: trackingError } = useDriverLocation({
    rideId: trackingRideId,
    rideStatus: trackingRideStatus,
    getToken: async () => (await getToken()) ?? '',
    enabled: true,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const refresh = params.get('refresh')

    if (connected === '1' || refresh === '1') {
      refreshStripeStatus()
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      loadDriver()
    }
  }, [user])

  async function refreshStripeStatus() {
    try {
      const token = await getToken()
      await paymentsAPI.getConnectStatus(token || undefined)
      loadDriver()
    } catch {
      loadDriver()
    }
  }

  useEffect(() => {
    if (driver?.verificationStatus === 'verified') {
      loadRides()
    }
  }, [tab, driver?.verificationStatus, page, typeFilter])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setDriverLocation({ lat, lng })
          try {
            const token = await getToken()
            if (token) {
              await ridesAPI.sendDriverLocation(lat, lng, token)
            }
          } catch {}
        },
        () => {},
        { enableHighAccuracy: true }
      )
    }
  }, [])

  // Conectar WebSocket de usuario para notificaciones en vivo (rating_updated, etc.)
  useEffect(() => {
    if (!user) return

    async function connectUserWs() {
      const token = await getToken()
      if (token) {
        userWsService.connect(token)
      }
    }
    connectUserWs()

    const unsubscribe = userWsService.onMessage((data) => {
      if (data.type === 'rating_updated' && data.data) {
        // Actualizar rating del conductor sin recargar todo
        setDriver(prev => prev ? {
          ...prev,
          rating: data.data.rating ?? prev.rating,
          totalRides: data.data.totalRides ?? prev.totalRides,
        } : prev)
      }
    })

    return () => {
      unsubscribe()
      userWsService.disconnect()
    }
  }, [user, getToken])


  async function loadDriver() {
    try {
      const token = await getToken()
      const data = await usersAPI.getDriver('me', token || undefined)
      setDriver(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  async function loadRides() {
    try {
      const token = await getToken()
      if (tab === 'available') {
        const params: any = { page, limit: 20 }
        if (typeFilter) params.type = typeFilter
        if (driverLocation) {
          params.lat = driverLocation.lat
          params.lng = driverLocation.lng
          params.radius = 100
        }

        const data = await ridesAPI.listAvailable(params, token || undefined)
        setAvailableRides(data.data || [])
      } else {
        const data = await ridesAPI.list({ driverId: user?.id, page, limit: 20 }, token || undefined)
        setMyRides(data.data || [])
      }
    } catch {
    }
  }

  async function handleConnectStripe() {
    try {
      const token = await getToken()
      const data = await paymentsAPI.createConnectAccount(token || undefined)
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
      }
    } catch {
    }
  }

  function handleStripeHistory() {
    navigate('/driver/payments/history')
  }

  async function uploadDeliveryPhoto(rideId: string, file: File) {
    setUploadingPhoto(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sin autorizacion')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'rides')

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al subir imagen')

      await ridesAPI.deliveryPhoto(rideId, data.url, data.publicId || '', token)
      loadRides()
    } catch {
    } finally {
      setUploadingPhoto(false)
    }
  }

  function handleDeliveryPhotoClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, rideId: string) {
    const file = e.target.files?.[0]
    if (file) {
      uploadDeliveryPhoto(rideId, file)
    }
    e.target.value = ''
  }

  const hasStripeAccount = !!driver?.stripeAccountId
  const canReceivePayments = driver?.payoutsEnabled === true
  const verificationStatus = driver?.verificationStatus
  const verificationBanners = {
    pending: {
      icon: 'hourglass_empty',
      color: 'var(--warning)',
      bgColor: 'var(--warning-subtle)',
      title: t('driver.dashboard.verificationPending'),
      description: t('driver.dashboard.verificationPendingDesc'),
    },
    in_review: {
      icon: 'visibility',
      color: 'var(--info)',
      bgColor: 'var(--info-subtle)',
      title: t('driver.dashboard.verificationInReview'),
      description: t('driver.dashboard.verificationInReviewDesc'),
    },
    rejected: {
      icon: 'error',
      color: 'var(--error)',
      bgColor: 'var(--error-subtle)',
      title: t('driver.dashboard.verificationRejected'),
      description: t('driver.dashboard.verificationRejectedDesc'),
    },
    suspended: {
      icon: 'block',
      color: 'var(--error)',
      bgColor: 'var(--error-subtle)',
      title: t('driver.dashboard.verificationSuspended'),
      description: t('driver.dashboard.verificationSuspendedDesc'),
    },
  }

  // Not registered
  if (!driver && !loading) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <EmptyState
          icon="how_to_reg"
          title={t('driver.dashboard.registerTitle')}
          description={t('driver.dashboard.registerDescription')}
          action={{
            label: t('driver.dashboard.registerAction'),
            href: '/register-driver',
          }}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    )
  }

  // Verification status banners
  if (verificationStatus !== 'verified') {
    const banner = verificationBanners[verificationStatus as keyof typeof verificationBanners]

    return (
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Back button */}
        <Link
          to="/"
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
          {t('driver.dashboard.backToHome')}
        </Link>

        <div
          className="card"
          style={{
            borderLeft: `4px solid ${banner.color}`,
            background: banner.bgColor,
            animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          }}
        >
          <div style={{
            display: 'flex',
            gap: 'var(--space-5)',
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: banner.color,
              color: 'white',
              borderRadius: 'var(--radius-lg)',
              flexShrink: 0,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '2rem' }}>
                {banner.icon}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--font-bold)',
                color: banner.color,
                marginBottom: 'var(--space-2)',
              }}>
                {banner.title}
              </h2>
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: verificationStatus === 'rejected' ? 'var(--space-4)' : 0,
              }}>
                {banner.description}
              </p>

              {verificationStatus === 'rejected' && driver?.rejectionReason && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  background: 'var(--surface-card)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                    color: 'var(--error)',
                    fontWeight: 'var(--font-semibold)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>info</span>
                    {t('driver.dashboard.rejectionReason')}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    {driver.rejectionReason}
                  </p>
                </div>
              )}

              {verificationStatus !== 'suspended' && (
                <Link
                  to="/driver/profile"
                  className="btn btn-primary"
                  style={{ marginTop: 'var(--space-5)' }}
                >
                  <span className="material-symbols-rounded">edit</span>
                  {verificationStatus === 'rejected' ? t('driver.dashboard.reSubmit') : t('driver.dashboard.viewProfile')}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Disabled tabs */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-8)',
        }}>
          <button className="btn btn-outline" disabled style={{ opacity: 0.5 }}>
            <span className="material-symbols-rounded">search</span>
            Pedidos Disponibles
          </button>
          <button className="btn btn-outline" disabled style={{ opacity: 0.5 }}>
            <span className="material-symbols-rounded">work_history</span>
            Mis Acarreos
          </button>
        </div>
      </div>
    )
  }

  // Verified driver - main dashboard
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Back button */}
      <Link
        to="/"
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
        Volver al inicio
      </Link>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-6)',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
      }}>
        <div>
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
              <span className="material-symbols-rounded">directions_car</span>
            </span>
            {t('driver.dashboard.title')}
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}>
            {t('driver.dashboard.panelSubtitle')}
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          {canReceivePayments ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--success-subtle)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--success)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>check_circle</span>
              {t('driver.dashboard.paymentsEnabled')}
            </div>
          ) : hasStripeAccount ? (
            <button
              className="btn btn-outline"
              onClick={handleStripeHistory}
            >
              <span className="material-symbols-rounded">history</span>
              {t('driver.dashboard.paymentHistory')}
            </button>
          ) : (
            <button
              className="btn btn-accent"
              onClick={handleConnectStripe}
            >
              <span className="material-symbols-rounded">payments</span>
              {t('driver.dashboard.connectPayments')}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <div
          className="card"
          style={{
            padding: 'var(--space-5)',
            background: 'linear-gradient(135deg, var(--primary-subtle) 0%, var(--surface-1) 100%)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>
              star
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('driver.profile.rating')}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
          }}>
            {driver?.rating?.toFixed(1) || '0.0'}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 'var(--space-5)',
            background: 'linear-gradient(135deg, var(--success-subtle) 0%, var(--surface-1) 100%)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--success)', fontSize: '1.5rem' }}>
              task_alt
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('driver.profile.totalRides')}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
          }}>
            {driver?.totalRides || 0}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 'var(--space-5)',
            background: 'linear-gradient(135deg, var(--warning-subtle) 0%, var(--surface-1) 100%)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--warning)', fontSize: '1.5rem' }}>
              local_shipping
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('driver.dashboard.myVehicle')}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-primary)',
          }}>
            {driver?.vehicleType || t('driver.dashboard.vehicleNotSpecified')}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            {driver?.plate || t('driver.dashboard.plateNotSpecified')}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 'var(--space-5)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}>
            <span className="material-symbols-rounded" style={{ color: driverLocation ? 'var(--success)' : 'var(--text-muted)', fontSize: '1.5rem' }}>
              location_on
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('driver.dashboard.location')}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            color: driverLocation ? 'var(--success)' : 'var(--text-muted)',
            fontWeight: 'var(--font-medium)',
          }}>
            {driverLocation ? t('driver.dashboard.detected') : t('driver.dashboard.notAvailable')}
          </div>
          <Link
            to="/driver/profile"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              marginTop: 'var(--space-2)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>edit</span>
            {t('driver.profile.editProfile')}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-1)',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius)',
        width: 'fit-content',
      }}>
        <button
          onClick={() => setTab('available')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-5)',
            background: tab === 'available' ? 'var(--primary)' : 'transparent',
            color: tab === 'available' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            cursor: 'pointer',
            transition: 'all var(--duration-fast) var(--ease-out)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>search</span>
          {t('driver.dashboard.available')}
          {availableRides.length > 0 && (
            <span style={{
              background: tab === 'available' ? 'rgba(255,255,255,0.2)' : 'var(--primary-subtle)',
              color: tab === 'available' ? 'white' : 'var(--primary)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-bold)',
            }}>
              {availableRides.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('mine')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-5)',
            background: tab === 'mine' ? 'var(--primary)' : 'transparent',
            color: tab === 'mine' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            cursor: 'pointer',
            transition: 'all var(--duration-fast) var(--ease-out)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>work_history</span>
          {t('driver.dashboard.myRides')}
          {myRides.length > 0 && (
            <span style={{
              background: tab === 'mine' ? 'rgba(255,255,255,0.2)' : 'var(--primary-subtle)',
              color: tab === 'mine' ? 'white' : 'var(--primary)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-bold)',
            }}>
              {myRides.length}
            </span>
          )}
        </button>
      </div>

      {/* Filters for available rides */}
      {tab === 'available' && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <label style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
            }}>{t('driver.dashboard.typeFilter')}</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              className="select"
              style={{ width: '150px' }}
            >
              <option value="">{t('driver.dashboard.filterAll')}</option>
              <option value="mudanza">{t('ride.type.mudanza')}</option>
              <option value="electrodomesticos">{t('ride.type.electrodomesticos')}</option>
              <option value="muebles">{t('ride.type.muebles')}</option>
              <option value="productos">{t('ride.type.productos')}</option>
              <option value="otros">{t('ride.type.otros')}</option>
            </select>
          </div>

          {availableRides.length > 0 && (
            <button
              onClick={() => setShowMapModal(true)}
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)',
                marginLeft: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary)'
                e.currentTarget.style.color = 'white'
                e.currentTarget.style.borderColor = 'var(--primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)'
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>map</span>
              Mapa
            </button>
          )}

          {driverLocation && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--success-subtle)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-xs)',
              color: 'var(--success)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>location_on</span>
              {t('driver.dashboard.locationDetected')}
            </div>
          )}
        </div>
      )}

      {/* Filters for my rides */}
      {tab === 'mine' && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {[
            { value: 'all', label: t('driver.dashboard.filterAll'), icon: 'list' },
            { value: 'pending', label: t('driver.dashboard.filterPending'), icon: 'pending_actions' },
            { value: 'in_progress', label: t('driver.dashboard.filterInProgress'), icon: 'local_shipping' },
            { value: 'paid', label: t('driver.dashboard.filterPaid'), icon: 'payments' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setMineFilter(opt.value); setPage(1) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                background: mineFilter === opt.value ? 'var(--primary)' : 'var(--bg-secondary)',
                color: mineFilter === opt.value ? 'white' : 'var(--text-secondary)',
                border: mineFilter === opt.value ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Rides List */}
      {tab === 'available' ? (
        availableRides.length === 0 ? (
          <EmptyState
            icon="search_off"
            title={t('driver.dashboard.noOrdersAvailable')}
            description={t('driver.dashboard.noOrdersInArea')}
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-4)',
          }} className="stagger-children">
            {availableRides.map((ride) => {
              const firstImage = ride.images?.[0]?.url

              return (
                <div
                  key={ride._id}
                  className="card card-hover"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* Image header */}
                  {firstImage && (
                    <div style={{
                      height: '140px',
                      background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
                      position: 'relative',
                    }}>
                      <img
                        src={firstImage}
                        alt={ride.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: 'var(--space-3)',
                        right: 'var(--space-3)',
                      }}>
                        <StatusBadge status={ride.status} size="sm" />
                      </div>
                    </div>
                  )}

                  <div style={{ padding: 'var(--space-4)' }}>
                    <Link
                      to={`/ride/${ride._id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <h3 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 'var(--font-semibold)',
                        marginBottom: 'var(--space-3)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {ride.title}
                      </h3>
                    </Link>

                    {/* Route */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-4)',
                      padding: 'var(--space-3)',
                      background: 'var(--surface-0)',
                      borderRadius: 'var(--radius)',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                      }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.875rem', color: 'var(--success)' }}>
                          circle
                        </span>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ride.pickupLocation.address}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                      }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.875rem', color: 'var(--error)' }}>
                          location_on
                        </span>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ride.dropoffLocation.address}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{
                      display: 'flex',
                      gap: 'var(--space-3)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      marginBottom: 'var(--space-4)',
                    }}>
                      {ride.packages && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>inventory_2</span>
                          {ride.packages} bultos
                        </span>
                      )}
                      {ride.distance !== undefined && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '3px',
                          padding: '1px 6px',
                          background: 'var(--primary-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 'var(--font-medium)',
                          color: 'var(--primary)',
                        }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>location_on</span>
                          {ride.distance < 1 
                            ? `${(ride.distance * 1000).toFixed(0)} m` 
                            : `${ride.distance.toFixed(1)} km`}
                        </span>
                      )}
                      {ride.type && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>category</span>
                          {ride.type}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 'var(--space-3)',
                      borderTop: '1px solid var(--border-subtle)',
                    }}>
                      <div>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xl)',
                          fontWeight: 'var(--font-bold)',
                          color: 'var(--secondary)',
                        }}>
                          ${ride.estimatedPrice.toLocaleString()}
                        </div>
                      </div>
                      <ChatButton rideId={ride._id} variant="outline" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : filteredMyRides.length === 0 ? (
          <EmptyState
            icon="work_off"
            title={mineFilter === 'all' ? t('driver.dashboard.mineEmptyTitle') : t(`driver.dashboard.mineEmpty${mineFilter === 'pending' ? 'Pending' : mineFilter === 'in_progress' ? 'InProgress' : 'Paid'}`)}
            description={mineFilter === 'all' ? t('driver.dashboard.mineEmptyDesc') : t('driver.dashboard.changeFilter')}
            action={mineFilter !== 'all' ? { label: t('driver.dashboard.viewAll'), onClick: () => setMineFilter('all') } : { label: t('driver.dashboard.viewAvailable'), onClick: () => setTab('available') }}
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-4)',
          }} className="stagger-children">
            {filteredMyRides.map((ride) => {
            const firstImage = ride.images?.[0]?.url

            return (
              <div
                key={ride._id}
                className="card card-hover"
                style={{ padding: 0, overflow: 'hidden' }}
              >
                {firstImage && (
                  <div style={{
                    height: '100px',
                    background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
                    position: 'relative',
                  }}>
                    <img
                      src={firstImage}
                      alt={ride.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'var(--space-3)',
                      right: 'var(--space-3)',
                    }}>
                      <StatusBadge status={ride.status} size="sm" />
                    </div>
                  </div>
                )}

                <div style={{ padding: 'var(--space-4)' }}>
                  <Link
                    to={`/ride/${ride._id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <h3 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--font-semibold)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      {ride.title}
                    </h3>
                  </Link>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-1)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    <span>{ride.pickupLocation.address}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>arrow_downward</span>
                      {ride.dropoffLocation.address}
                    </span>
                  </div>

                  {/* Quick actions */}
                  <div style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    flexWrap: 'wrap',
                    marginBottom: 'var(--space-3)',
                  }}>
                    <Link to={`/ride/${ride._id}`} className="btn btn-outline btn-sm">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>visibility</span>
                      {t('common.view')}
                    </Link>
                    <Link to={`/chat/${ride._id}`} className="btn btn-outline btn-sm">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>chat</span>
                      Chat
                    </Link>

                    {ride.status === 'accepted' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          const { showConfirm } = await import('../services/alerts')
                          const confirmed = await showConfirm({
                            title: 'Confirmar carga',
                            text: '¿Confirmas que tienes la mercancia cargada?'
                          })

                          if (!confirmed) return
                          try {
                            const token = await getToken()
                            await ridesAPI.start(ride._id, token || undefined)

                            const ridesData = await ridesAPI.list({ 
                              driverId: user?.id, 
                              page: 1, 
                              limit: 50,
                            }, token || undefined)
                            setMyRides(ridesData.data || [])
                            
                            // Switch to 'mine' tab so user can see the updated ride
                            if (tab !== 'mine') {
                              setTab('mine')
                            }
                          } catch (err) {
                            console.error('Error starting trip:', err)
                          }
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>play_arrow</span>
                        Iniciar Viaje
                      </button>
                    )}

                    {ride.status === 'in_progress' && (
                      <>
                        {/* Tracking activo badge */}
                        {isTrackingActive && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            background: 'var(--success-subtle)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--success)',
                            fontWeight: 'var(--font-medium)',
                            marginBottom: 'var(--space-2)',
                          }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>my_location</span>
                            {t('driver.dashboard.sharingLocation')}
                          </div>
                        )}
                        {trackingError && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            background: 'var(--error-subtle)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--error)',
                            fontWeight: 'var(--font-medium)',
                            marginBottom: 'var(--space-2)',
                          }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>warning</span>
                            {t('driver.dashboard.locationError')}
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileChange(e, ride._id)}
                        />
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeliveryPhotoClick()}
                          disabled={uploadingPhoto}
                        >
                          {uploadingPhoto ? (
                            <>
                              <div className="spinner" style={{ width: '14px', height: '14px' }} />
                              {t('driver.dashboard.uploading')}...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>photo_camera</span>
                              {t('driver.dashboard.deliveryPhoto')}
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--font-bold)',
                      color: 'var(--primary)',
                    }}>
                      ${(ride.finalPrice || ride.estimatedPrice).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showMapModal && (
        <RideMapModal
          rides={availableRides}
          driverLocation={driverLocation}
          onClose={() => setShowMapModal(false)}
          onNavigate={handleRideNavigate}
        />
      )}
    </div>
  )
}

export default DriverDashboard