import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Ride } from '../types'
import { ImageCarousel } from '../components/ImageCarousel'
import { MapView } from '../components/MapView'
import { DistanceBadge } from '../components/DistanceBadge'

/**
 * Driver Ride Details Page
 *
 * Shows:
 * - Full ride information (title, description, type)
 * - Image carousel
 * - Pickup/dropoff locations with map preview
 * - Client profile (name, rating, phone)
 * - Estimated price and distance
 * - Action buttons: Accept, Chat, Cancel, or Status badges
 *
 * Accessible from:
 * - DriverDashboard (list of nearby rides)
 * - DriverChat (current negotiation)
 * - DriverProfile (my accepted rides)
 */
export const DriverRideDetails: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [ride, setRide] = useState<Ride | null>(null)
  const [clientProfile, setClientProfile] = useState<{
    name: string
    imageUrl?: string
    rating: number
    totalRides: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Initialize token
  useEffect(() => {
    const initToken = async () => {
      const t = await getToken()
      setToken(t)
    }
    initToken()
  }, [getToken])

  // Fetch ride details
  useEffect(() => {
    if (rideId && token) {
      fetchRideDetails()
    }
  }, [rideId, token])

  const fetchRideDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/rides/${rideId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Failed to fetch ride details')
      }

      const data = await response.json()
      setRide(data.ride)

      // Fetch client profile
      if (data.client) {
        setClientProfile({
          name: `${data.client.firstName || ''} ${data.client.lastName || ''}`.trim(),
          imageUrl: data.client.imageUrl,
          rating: data.client.rating || 0,
          totalRides: data.client.totalRides || 0,
        })
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load ride details'
      setError(errorMessage)
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (price?: number) => {
    if (!token) return

    setAccepting(true)
    try {
      const response = await fetch(`/api/rides/${rideId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          finalPrice: price || ride?.estimatedPrice,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to accept ride')
      }

      // Success - navigate to chat to negotiate or confirm
      navigate(`/driver/rides/${rideId}/chat`)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to accept ride'
      setError(errorMessage)
      console.error('Accept error:', err)
    } finally {
      setAccepting(false)
    }
  }

  const handleCancel = async (reason: string) => {
    if (!token) return

    if (!window.confirm('¿Estás seguro de que deseas cancelar este encargo?')) {
      return
    }

    setCancelling(true)
    try {
      const response = await fetch(`/api/rides/${rideId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancellationReason: reason }),
      })

      if (!response.ok) {
        throw new Error('Failed to cancel ride')
      }

      // Success - go back to dashboard
      navigate('/driver/dashboard')
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to cancel ride'
      setError(errorMessage)
      console.error('Cancel error:', err)
    } finally {
      setCancelling(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              animation: 'spin 2s linear infinite',
            }}
            className="material-symbols-rounded"
          >
            schedule
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Cargando encargo...</p>
        </div>
      </div>
    )
  }

  // Not found
  if (!ride) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Encargo no encontrado
          </p>
          <Link
            to="/driver/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--primary)',
              color: 'white',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <span className="material-symbols-rounded">arrow_back</span>
            Volver a Encargos
          </Link>
        </div>
      </div>
    )
  }

  const canAccept = ride.status === 'requested'
  const canCancel = ride.status === 'accepted'
  const statusColor =
    ride.status === 'accepted'
      ? 'var(--success)'
      : ride.status === 'cancelled'
        ? 'var(--error)'
        : 'var(--warning)'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          padding: '1.5rem 1rem',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Detalles del Encargo
          </h1>
          <Link
            to="/driver/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>
              arrow_back
            </span>
            Volver
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '1.5rem 1rem',
        }}
      >
        {/* Error banner */}
        {error && (
          <div
            style={{
              backgroundColor: '#FEE2E2',
              borderLeft: '4px solid var(--error)',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.5rem',
              color: '#7F1D1D',
              fontSize: '0.875rem',
            }}
          >
            ❌ {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '1.5rem' }}>
          {/* Left column: Images and details */}
          <div>
            {/* Image carousel */}
            {ride.images && ride.images.length > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                  marginBottom: '1.5rem',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <ImageCarousel images={ride.images} />
              </div>
            )}

            {/* Title and type */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {ride.title}
                  </h2>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {ride.type}
                  </span>
                </div>
                <span
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: statusColor,
                    color: 'white',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {ride.status}
                </span>
              </div>

              <p
                style={{
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {ride.description}
              </p>

              {ride.notes && (
                <div
                  style={{
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-muted)',
                      margin: '0 0 0.5rem 0',
                      fontWeight: 600,
                    }}
                  >
                    Notas especiales:
                  </p>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      margin: 0,
                    }}
                  >
                    {ride.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Locations */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                boxShadow: 'var(--shadow)',
              }}
            >
              <h3
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)',
                }}
              >
                Ubicaciones
              </h3>

              {/* Map preview */}
              <MapView
                pickupLocation={ride.pickupLocation}
                dropoffLocation={ride.dropoffLocation}
              />

              {/* Location details */}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      margin: '0 0 0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                      location_on
                    </span>
                    Recogida:
                  </p>
                  <p
                    style={{
                      color: 'var(--text-primary)',
                      margin: 0,
                      paddingLeft: '1.5rem',
                    }}
                  >
                    {ride.pickupLocation.address}
                  </p>
                </div>

                <div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      margin: '0 0 0.5rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                      location_on
                    </span>
                    Entrega:
                  </p>
                  <p
                    style={{
                      color: 'var(--text-primary)',
                      margin: 0,
                      paddingLeft: '1.5rem',
                    }}
                  >
                    {ride.dropoffLocation.address}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Summary and actions */}
          <div>
            {/* Price and distance */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <p
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    margin: '0 0 0.5rem 0',
                  }}
                >
                  Precio ofrecido:
                </p>
                <p
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--secondary)',
                    fontFamily: 'var(--font-mono)',
                    margin: 0,
                  }}
                >
                  ${ride.estimatedPrice.toFixed(2)}
                </p>
              </div>

              {ride.distance && (
                <div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      margin: '0 0 0.5rem 0',
                    }}
                  >
                    Distancia estimada:
                  </p>
                  <DistanceBadge distance={ride.distance} />
                </div>
              )}
            </div>

            {/* Client profile */}
            {clientProfile && (
              <div
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <p
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    margin: '0 0 1rem 0',
                  }}
                >
                  Información del cliente:
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {clientProfile.imageUrl && (
                    <img
                      src={clientProfile.imageUrl}
                      alt={clientProfile.name}
                      style={{
                        width: '3rem',
                        height: '3rem',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        margin: '0 0 0.5rem 0',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {clientProfile.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span
                        className="material-symbols-rounded"
                        style={{ fontSize: '1rem' }}
                      >
                        star
                      </span>
                      {clientProfile.rating.toFixed(1)} ({clientProfile.totalRides} viajes)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {canAccept && (
                <>
                  <button
                    onClick={() => handleAccept()}
                    disabled={accepting}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: accepting ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      opacity: accepting ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!accepting) {
                        e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--primary)'
                    }}
                  >
                    {accepting ? 'Aceptando...' : '✅ Aceptar Encargo'}
                  </button>

                  <button
                    onClick={() => navigate(`/driver/rides/${rideId}/chat`)}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'transparent',
                      border: '2px solid var(--primary)',
                      color: 'var(--primary)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    💬 Negociar Precio
                  </button>
                </>
              )}

              {canCancel && (
                <button
                  onClick={() =>
                    handleCancel('Cambié de opinión sobre este encargo')
                  }
                  disabled={cancelling}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--error)',
                    color: 'var(--error)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    opacity: cancelling ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!cancelling) {
                      e.currentTarget.style.backgroundColor = '#FEE2E2'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {cancelling ? 'Cancelando...' : '❌ Cancelar Encargo'}
                </button>
              )}

              {!canAccept && !canCancel && (
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                  }}
                >
                  Este encargo no puede ser aceptado en este momento
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default DriverRideDetails
