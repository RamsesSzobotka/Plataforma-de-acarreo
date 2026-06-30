import { Link } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'

interface RideCardProps {
  ride: {
    _id: string
    title: string
    status: string
    pickupLocation: { address: string }
    dropoffLocation: { address: string }
    estimatedPrice: number
    images?: Array<{ url: string }>
    driverId?: string
    createdAt: string
  }
  onChatClick?: () => void
  showDriverInfo?: boolean
}

export function RideCard({ ride, onChatClick, showDriverInfo: _showDriverInfo = false }: RideCardProps) {
  const firstImage = ride.images?.[0]?.url

  return (
    <Link
      to={`/ride/${ride._id}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        className="card card-hover"
        style={{
          padding: 0,
          overflow: 'hidden',
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}
      >
        {/* Image header */}
        {firstImage && (
          <div style={{
            height: '140px',
            background: `linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)`,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <img
              src={firstImage}
              alt={ride.title}
              className="ride-card-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Status badge overlay */}
            <div style={{
              position: 'absolute',
              top: 'var(--space-3)',
              right: 'var(--space-3)',
            }}>
              <StatusBadge status={ride.status} size="sm" />
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: 'var(--space-4)' }}>
          {/* Title and price */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              flex: 1,
            }}>
              {ride.title}
            </h3>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--secondary)',
              whiteSpace: 'nowrap',
            }}>
              ${ride.estimatedPrice.toLocaleString()}
            </div>
          </div>

          {/* Locations */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--success)' }}>
                circle
              </span>
              <span className="truncate">{ride.pickupLocation.address}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--error)' }}>
                location_on
              </span>
              <span className="truncate">{ride.dropoffLocation.address}</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>
                schedule
              </span>
              {new Date(ride.createdAt).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
              })}
            </span>

            {(ride.status === 'accepted' || (ride.driverId && (ride.status === 'in_progress' || ride.status === 'completed'))) ? (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  onChatClick?.()
                }}
                className="btn btn-sm btn-outline"
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  fontSize: '0.7rem',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>
                  chat
                </span>
                Chatear
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default RideCard