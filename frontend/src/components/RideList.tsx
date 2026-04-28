import React from 'react'
import { RideCard, RideCardProps } from './RideCard'

interface RideListProps {
  rides: RideCardProps[]
  loading?: boolean
  error?: string | null
  onLoadMore?: () => void
  hasMore?: boolean
  onRideClick: (rideId: string) => void
}

/**
 * Ride list component with pagination and loading states
 */
export const RideList: React.FC<RideListProps> = ({
  rides,
  loading,
  error,
  onLoadMore,
  hasMore,
  onRideClick,
}) => {
  // Loading state - show skeleton cards
  if (loading && rides.length === 0) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
          padding: '1rem',
        }}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1rem',
              minHeight: '150px',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#FEE2E2',
          borderRadius: 'var(--radius)',
          border: '1px solid #FCA5A5',
          margin: '1rem',
        }}
      >
        <p
          style={{
            color: '#7F1D1D',
            fontWeight: 600,
            margin: 0,
          }}
        >
          ❌ {error}
        </p>
      </div>
    )
  }

  // Empty state
  if (rides.length === 0 && !loading) {
    return (
      <div
        style={{
          padding: '3rem 1rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem',
          }}
        >
          No hay encargos disponibles en tu área
        </p>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          Intenta expandir el radio de búsqueda
        </p>
      </div>
    )
  }

  // Rides list
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
          padding: '1rem',
        }}
      >
        {rides.map((ride) => (
          <RideCard
            key={ride._id}
            {...ride}
            onClick={() => onRideClick(ride._id)}
          />
        ))}
      </div>

      {/* Load More button */}
      {hasMore && !loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <button
            onClick={onLoadMore}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary)'
            }}
          >
            Cargar más encargos
          </button>
        </div>
      )}

      {/* Loading state while fetching more */}
      {loading && rides.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              width: '2rem',
              height: '2rem',
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
