import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useGeolocation } from '../hooks/useGeolocation'
import { useRideList } from '../hooks/useRideList'
import { useVerification } from '../hooks/useVerification'
import { RadiusSelector } from '../components/RadiusSelector'
import { RideList } from '../components/RideList'
import { VerificationStatus } from '../components/VerificationStatus'
import { RideCardProps } from '../components/RideCard'

/**
 * Driver Dashboard - Main page for ride discovery
 * 
 * Features:
 * - Geolocation permission request
 * - Verification gate
 * - Radius selector (5/10/25/50 km)
 * - Geospatial ride discovery
 * - Pagination with load more
 */
export const DriverDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const geolocation = useGeolocation()
  const rideList = useRideList()
  const verification = useVerification()
  const [radius, setRadius] = useState<number>(25)
  const [token, setToken] = useState<string | null>(null)

  // Initialize token
  useEffect(() => {
    const initToken = async () => {
      const t = await getToken()
      setToken(t)
    }
    initToken()
  }, [getToken])

  // Fetch rides when geolocation updates or radius changes
  useEffect(() => {
    if (geolocation.lat && geolocation.lng && token && verification.isVerified) {
      rideList.handleRadiusChange(
        geolocation.lat,
        geolocation.lng,
        radius,
        token,
      )
    }
  }, [geolocation.lat, geolocation.lng, radius, token, verification.isVerified])

  // Handle ride click
  const handleRideClick = (rideId: string) => {
    navigate(`/driver/rides/${rideId}`)
  }

  // Geolocation error message
  const getLocationErrorMessage = (): string | null => {
    if (!geolocation.error) return null

    switch (geolocation.error) {
      case 'PERMISSION_DENIED':
        return '📍 No pudimos obtener tu ubicación. Intenta permitir acceso en configuración de tu navegador.'
      case 'POSITION_UNAVAILABLE':
        return '📍 Tu ubicación no está disponible en este momento. Intenta de nuevo.'
      case 'TIMEOUT':
        return '📍 La solicitud de ubicación expiró. Intenta de nuevo.'
      default:
        return '📍 Error obteniendo ubicación'
    }
  }

  // Main render
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
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
          {/* Title */}
          <div>
            <h1
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span className="material-symbols-rounded">local_shipping</span>
              Encontrar Encargos
            </h1>
            {geolocation.lat && geolocation.lng && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                }}
              >
                📍 {geolocation.lat.toFixed(4)}, {geolocation.lng.toFixed(4)}
              </p>
            )}
          </div>

          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>
              arrow_back
            </span>
            Volver
          </button>
        </div>
      </header>

      {/* Geolocation banner (if in progress or error) */}
      {geolocation.loading && (
        <div
          style={{
            backgroundColor: '#FEF3C7',
            borderBottom: '1px solid #F59E0B',
            padding: '1rem',
            textAlign: 'center',
            color: '#78350F',
            fontSize: '0.875rem',
          }}
        >
          📍 Obteniendo tu ubicación...
        </div>
      )}

      {getLocationErrorMessage() && (
        <div
          style={{
            backgroundColor: '#FEE2E2',
            borderBottom: '1px solid #EF4444',
            padding: '1rem',
            textAlign: 'center',
            color: '#7F1D1D',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          {getLocationErrorMessage()}
          <button
            onClick={() => geolocation.refetch()}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main content */}
      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '1rem',
        }}
      >
        {/* Verification blocking modal */}
        {!verification.isVerified && (
          <VerificationStatus
            status={verification.status}
            rejectionReason={verification.rejectionReason}
            onEditProfile={() => navigate('/driver/profile')}
          />
        )}

        {/* Content visible only if verified */}
        {verification.isVerified && (
          <div>
            {/* Radius selector */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem 1rem',
                marginBottom: '1.5rem',
                boxShadow: 'var(--shadow)',
              }}
            >
              <p
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Radio de búsqueda:
              </p>
              <RadiusSelector
                currentRadius={radius}
                onRadiusChange={setRadius}
              />
            </div>

            {/* Ride list */}
            {geolocation.lat && geolocation.lng ? (
              <RideList
                rides={rideList.rides as RideCardProps[]}
                loading={rideList.loading}
                error={rideList.error}
                hasMore={rideList.pagination.hasMore}
                onLoadMore={() => {
                  rideList.loadMore(
                    geolocation.lat!,
                    geolocation.lng!,
                    radius,
                    token!,
                  )
                }}
                onRideClick={handleRideClick}
              />
            ) : (
              <div
                style={{
                  padding: '3rem 1rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  Obteniendo tu ubicación...
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default DriverDashboard

