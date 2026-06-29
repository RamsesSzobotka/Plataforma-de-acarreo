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
  const [ratings, setRatings] = useState<RatingWithRater[]>([])
  const [totalRatings, setTotalRatings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      if (!clerkId) return
      const token = await getToken()
      if (!token) return
      try {
        const [userData, driverData, ratingsData] = await Promise.all([
          usersAPI.get(clerkId, token),
          usersAPI.getDriver(clerkId, token).catch(() => null),
          ratingsAPI.getDriverRatings(clerkId, { page: 1, limit: 50 }, token),
        ])
        setDriverUser(userData)
        setDriver(driverData)
        setRatings(ratingsData.data)
        setTotalRatings(ratingsData.pagination?.total || 0)
      } catch (err) {
        console.error('Error loading driver profile:', err)
        setError('No se pudo cargar el perfil del conductor')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [clerkId, getToken])

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
          <p style={{ color: 'var(--error)', marginBottom: 'var(--space-5)' }}>{error || 'Conductor no encontrado'}</p>
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
    .toUpperCase() || 'D'

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

            {/* Rating */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}>
              {driver ? (
                <>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {renderStars(driver.rating)}
                  </div>
                  <strong style={{ fontSize: 'var(--text-lg)' }}>{driver.rating}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    ({driver.totalRides} viajes)
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Sin calificaciones aún
                </span>
              )}
            </div>

            {/* Vehicle info */}
            {driver && (
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
            )}

            {/* Verification badge */}
            {driver?.verificationStatus === 'verified' && (
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
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="card">
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
          Reseñas ({totalRatings})
        </h2>

        {ratings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--text-muted)',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', marginBottom: 'var(--space-2)', opacity: 0.5 }}>rate_review</span>
            <p>Este conductor aún no tiene reseñas.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {ratings.map((r) => (
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
                  {/* Rater avatar */}
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
                      {r.rater?.firstName} {r.rater?.lastName || 'Cliente'}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverPublicProfile
