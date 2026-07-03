import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { usersAPI, ratingsAPI } from '../services/api'
import type { RatingWithRater } from '../types'

function DriverPublicProfile() {
  const { clerkId } = useParams<{ clerkId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [driverUser, setDriverUser] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [driverRatings, setDriverRatings] = useState<RatingWithRater[]>([])
  const [driverRatingsTotal, setDriverRatingsTotal] = useState(0)
  const [clientRatings, setClientRatings] = useState<RatingWithRater[]>([])
  const [clientRatingsTotal, setClientRatingsTotal] = useState(0)
  const [activeTab, setActiveTab] = useState<'driver' | 'client'>('driver')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      if (!clerkId) return
      const token = await getToken()
      if (!token) return
      try {
        const [userData, driverData, driverRatingsData, clientRatingsData] = await Promise.all([
          usersAPI.get(clerkId, token),
          usersAPI.getDriver(clerkId, token).catch(() => null),
          ratingsAPI.getDriverRatings(clerkId, { page: 1, limit: 50 }, token),
          ratingsAPI.getClientRatings(clerkId, { page: 1, limit: 50 }, token),
        ])
        setDriverUser(userData)
        setDriver(driverData)
        setDriverRatings(driverRatingsData.data)
        setDriverRatingsTotal(driverRatingsData.pagination?.total || 0)
        setClientRatings(clientRatingsData.data)
        setClientRatingsTotal(clientRatingsData.pagination?.total || 0)
      } catch (err) {
        console.error('Error loading profile:', err)
        setError('No se pudo cargar el perfil')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [clerkId, getToken])

  const hasDriverProfile = driver !== null

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: 'var(--space-8) 0' }}>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    )
  }

  if (error || !driverUser) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-8) 0', textAlign: 'center' }}>
        <div className="card">
          <span className="material-symbols-rounded" style={{ fontSize: '4rem', color: 'var(--error)', marginBottom: 'var(--space-4)' }}>error</span>
          <p style={{ color: 'var(--error)', marginBottom: 'var(--space-5)' }}>{error || 'Usuario no encontrado'}</p>
          <button className="btn btn-outline" onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
            Volver
          </button>
        </div>
      </div>
    )
  }

  const initials = [driverUser.firstName, driverUser.lastName]
    .filter(Boolean)
    .map((n: string) => n.charAt(0))
    .join('')
    .toUpperCase() || 'U'

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className="material-symbols-rounded"
        style={{
          fontSize: '1.25rem',
          color: i < Math.round(rating) ? 'var(--warning)' : 'var(--border)',
          fontVariationSettings: i < Math.round(rating) ? "'FILL' 1" : "'FILL' 0",
        }}
      >
        star
      </span>
    ))
  }

  const renderReviewCard = (r: RatingWithRater) => (
    <div
      key={r._id}
      style={{
        padding: 'var(--space-4)',
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-2)',
      }}>
        {r.rater?.imageUrl ? (
          <img
            src={r.rater.imageUrl}
            alt={r.rater.firstName}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--primary-subtle)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
          }}>
            {r.rater?.firstName?.charAt(0) || '?'}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 'var(--font-semibold)',
            fontSize: 'var(--text-sm)',
          }}>
            {r.rater?.firstName} {r.rater?.lastName || 'Usuario'}
          </div>
          <div style={{ display: 'flex', gap: '1px', marginTop: '2px' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="material-symbols-rounded"
                style={{
                  fontSize: '0.875rem',
                  color: i < r.rating ? 'var(--warning)' : 'var(--border)',
                  fontVariationSettings: i < r.rating ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                star
              </span>
            ))}
          </div>
        </div>
        <span style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}>
          {new Date(r.createdAt).toLocaleDateString('es-PA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
      {r.comment && (
        <p style={{
          margin: 'var(--space-2) 0 0',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          {r.comment}
        </p>
      )}
    </div>
  )

  const renderEmptyReviews = (role: 'conductor' | 'cliente') => (
    <div style={{
      textAlign: 'center',
      padding: 'var(--space-8)',
      color: 'var(--text-muted)',
    }}>
      <span className="material-symbols-rounded" style={{ fontSize: '3rem', marginBottom: 'var(--space-2)', opacity: 0.5 }}>rate_review</span>
      <p>Aún no tiene reseñas como {role}.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost"
        style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}
      >
        <span className="material-symbols-rounded">arrow_back</span>
        Volver
      </button>

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-5)',
          flexWrap: 'wrap',
        }}>
          {/* Avatar */}
          {driverUser.imageUrl ? (
            <img
              src={driverUser.imageUrl}
              alt={driverUser.firstName}
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid var(--primary-subtle)',
              }}
            />
          ) : (
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              border: '4px solid var(--primary-subtle)',
            }}>
              {initials}
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              margin: '0 0 var(--space-1)',
            }}>
              {driverUser.firstName} {driverUser.lastName}
            </h1>

            {hasDriverProfile ? (
              <>
                {/* Rating */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-2)',
                }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {renderStars(driver.rating)}
                  </div>
                  <strong style={{ fontSize: 'var(--text-lg)' }}>{driver.rating}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    ({driver.totalRides} viajes)
                  </span>
                </div>

                {/* Vehicle info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>local_shipping</span>
                  {driver.vehicleType} - {driver.plate}
                </div>

                {/* Verification badge */}
                {driver.verificationStatus === 'verified' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    marginTop: 'var(--space-2)',
                    color: 'var(--success)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>verified</span>
                    Conductor Verificado
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Cliente
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="card">
        {hasDriverProfile ? (
          <>
            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '2px solid var(--border)',
              marginBottom: 'var(--space-4)',
            }}>
              <button
                onClick={() => setActiveTab('driver')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3) var(--space-4)',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-semibold)',
                  color: activeTab === 'driver' ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'driver' ? '3px solid var(--primary)' : '3px solid transparent',
                  marginBottom: '-2px',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>local_shipping</span>
                Reseñas como conductor ({driverRatingsTotal})
              </button>
              <button
                onClick={() => setActiveTab('client')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3) var(--space-4)',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-semibold)',
                  color: activeTab === 'client' ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'client' ? '3px solid var(--primary)' : '3px solid transparent',
                  marginBottom: '-2px',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>person</span>
                Reseñas como cliente ({clientRatingsTotal})
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'driver' ? (
              driverRatings.length === 0
                ? renderEmptyReviews('conductor')
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {driverRatings.map(renderReviewCard)}
                  </div>
                )
            ) : (
              clientRatings.length === 0
                ? renderEmptyReviews('cliente')
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {clientRatings.map(renderReviewCard)}
                  </div>
                )
            )}
          </>
        ) : (
          <>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-semibold)',
              margin: '0 0 var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <span className="material-symbols-rounded" style={{ color: 'var(--warning)' }}>reviews</span>
              Reseñas como cliente ({clientRatingsTotal})
            </h2>
            {clientRatings.length === 0
              ? renderEmptyReviews('cliente')
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {clientRatings.map(renderReviewCard)}
                </div>
              )
            }
          </>
        )}
      </div>
    </div>
  )
}

export default DriverPublicProfile
