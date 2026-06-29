import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import ChatButton from '../components/ChatButton'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { ridesAPI, usersAPI, paymentsAPI } from '../services/api'
import { showConfirm } from '../services/alerts'
import { useDriverLocation } from '../hooks/useDriverLocation'

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

interface Ride {
  _id: string
  title: string
  type: string
  status: string
  estimatedPrice: number
  finalPrice?: number
  pickupLocation: { address: string; coordinates?: { type: string; coordinates: number[] } }
  dropoffLocation: { address: string; coordinates?: { type: string; coordinates: number[] } }
  description: string
  images?: { url: string; publicId?: string }[]
  packages?: number
  weight?: number
  distance?: number
  driverId?: string
  clientId?: string
  deliveryPhoto?: { url: string }
}

const verificationBanners = {
  pending: {
    icon: 'hourglass_empty',
    color: 'var(--warning)',
    bgColor: 'var(--warning-subtle)',
    title: 'Verificacion Pendiente',
    description: 'Tus documentos estan en revision. No podras aceptar encargos hasta que un admin apruebe tu perfil.',
  },
  in_review: {
    icon: 'visibility',
    color: 'var(--info)',
    bgColor: 'var(--info-subtle)',
    title: 'En Revision',
    description: 'Un administrador esta revisando tus documentos. Te notificaremos cuando termine la revision.',
  },
  rejected: {
    icon: 'error',
    color: 'var(--error)',
    bgColor: 'var(--error-subtle)',
    title: 'Verificacion Rechazada',
    description: 'Por favor, corrige los documentos y vuelve a enviar para revision.',
  },
  suspended: {
    icon: 'block',
    color: 'var(--error)',
    bgColor: 'var(--error-subtle)',
    title: 'Cuenta Suspendida',
    description: 'Tu cuenta ha sido suspendida. Contacta al administrador para mas informacion.',
  },
}

function DriverDashboard() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableRides, setAvailableRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'available' | 'mine'>('available')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [driverLocation, setDriverLocation] = useState<{lat: number; lng: number} | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Tracking automático cuando hay un viaje activo ──
  const activeRide = myRides.find(r => r.status === 'in_progress')
  const { isSharing: isTrackingActive, error: trackingError } = useDriverLocation({
    rideId: activeRide?._id ?? '',
    rideStatus: activeRide?.status ?? '',
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
    } catch (error) {
      console.error('Error refreshing Stripe status:', error)
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
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => console.error('Error getting location:', error),
        { enableHighAccuracy: true }
      )
    }
  }, [])

  async function loadDriver() {
    try {
      const token = await getToken()
      const data = await usersAPI.getDriver('me', token || undefined)
      setDriver(data)
    } catch (error) {
      console.error('Error loading driver:', error)
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

        const data = await ridesAPI.listAvailable(params, token || undefined)
        setAvailableRides(data.data || [])
        setTotalPages(data.pagination?.pages || 1)
      } else {
        const data = await ridesAPI.list({ driverId: user?.id, page, limit: 20 }, token || undefined)
        setMyRides(data.data || [])
        if (data.pagination) {
          setTotalPages(data.pagination.pages)
        }
      }
    } catch (error) {
      console.error('Error loading rides:', error)
    }
  }

  async function handleAcceptRide(rideId: string, price: number) {
    if (!user) return

    try {
      const token = await getToken()
      await ridesAPI.accept(rideId, user.id, price, token || undefined)
      loadRides()
    } catch (error) {
      console.error('Error accepting ride:', error)
    }
  }

  async function handleConnectStripe() {
    try {
      const token = await getToken()
      const data = await paymentsAPI.createConnectAccount(token || undefined)
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error)
    }
  }

  function handleStripeHistory() {
    navigate('/driver/payments/history')
  }

  async function uploadDeliveryPhoto(rideId: string, file: File) {
    setPhotoError(null)
    setUploadingPhoto(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sin autorizacion')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'rides')

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al subir imagen')

      await ridesAPI.deliveryPhoto(rideId, data.url, data.publicId || '', token)
      loadRides()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconhecido'
      setPhotoError(message)
      console.error('Error uploading photo:', err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  function handleDeliveryPhotoClick(rideId: string) {
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

  // Not registered
  if (!driver && !loading) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <EmptyState
          icon="how_to_reg"
          title="Registrate como Conductor"
          description="Para comenzar a aceptar acarreos, necesitas completar tu registro y verificacion de documentos."
          action={{
            label: 'Registrarse como Conductor',
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
          Volver al inicio
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
                    Motivo del rechazo
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
                  {verificationStatus === 'rejected' ? 'Corregir y Reenviar' : 'Ver mi perfil'}
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
            Panel del Conductor
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}>
            Gestiona tus pedidos y acarreos
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
              Pagos habilitados
            </div>
          ) : hasStripeAccount ? (
            <button
              className="btn btn-outline"
              onClick={handleStripeHistory}
            >
              <span className="material-symbols-rounded">history</span>
              Historial de Pagos
            </button>
          ) : (
            <button
              className="btn btn-accent"
              onClick={handleConnectStripe}
            >
              <span className="material-symbols-rounded">payments</span>
              Activar Pagos
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
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Calificacion</span>
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
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Viajes Completados</span>
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
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Mi Vehiculo</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-primary)',
          }}>
            {driver?.vehicleType || 'No especificado'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            {driver?.plate || '---'}
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
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Ubicacion</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            color: driverLocation ? 'var(--success)' : 'var(--text-muted)',
            fontWeight: 'var(--font-medium)',
          }}>
            {driverLocation ? 'Detectada' : 'No disponible'}
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
            Editar perfil
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
          Pedidos Disponibles
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
          Mis Acarreos
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
            }}>Tipo:</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              className="select"
              style={{ width: '150px' }}
            >
              <option value="">Todos</option>
              <option value="mudanza">Mudanza</option>
              <option value="electrodomesticos">Electrodomesticos</option>
              <option value="muebles">Muebles</option>
              <option value="productos">Productos</option>
              <option value="otros">Otros</option>
            </select>
          </div>

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
              Ubicacion detectada
            </div>
          )}
        </div>
      )}

      {/* Rides List */}
      {tab === 'available' ? (
        availableRides.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No hay pedidos disponibles"
            description="No hay pedidos disponibles en este momento. Revisa mas tarde."
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
                      <ChatButton rideId={ride._id} variant="outline" size="sm" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : myRides.length === 0 ? (
        <EmptyState
          icon="work_off"
          title="No tienes acarreos aceptados"
          description="Cuando aceptes un pedido, aparecera aqui."
          action={{
            label: 'Ver Pedidos Disponibles',
            onClick: () => setTab('available'),
          }}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }} className="stagger-children">
          {myRides.map((ride) => {
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
                      Ver
                    </Link>
                    <Link to={`/chat/${ride._id}`} className="btn btn-outline btn-sm">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>chat</span>
                      Chat
                    </Link>

                    {ride.status === 'accepted' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          const confirmed = await showConfirm({
                            title: 'Confirmar carga',
                            text: '¿Confirmas que tienes la mercancia cargada?'
                          })

                          if (!confirmed) return
                          try {
                            const token = await getToken()
                            await ridesAPI.start(ride._id, token || undefined)
                            loadRides()
                          } catch (error) {
                            console.error('Error starting ride:', error)
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
                            Compartiendo ubicacion
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
                            Error de ubicacion
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
                          onClick={() => handleDeliveryPhotoClick(ride._id)}
                          disabled={uploadingPhoto}
                        >
                          {uploadingPhoto ? (
                            <>
                              <div className="spinner" style={{ width: '14px', height: '14px' }} />
                              Subiendo...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>photo_camera</span>
                              Foto Entrega
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
    </div>
  )
}

export default DriverDashboard