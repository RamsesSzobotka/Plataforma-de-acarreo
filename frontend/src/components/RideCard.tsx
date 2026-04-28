import React from 'react'
import { DistanceBadge } from './DistanceBadge'

export interface RideCardProps {
  _id: string
  title: string
  type: string
  distance: number
  estimatedPrice: number
  client?: {
    firstName?: string
    rating?: number
  }
  onClick: () => void
  thumbnail?: string
}

/**
 * Ride card component for the ride list
 * Displays: title, type, distance, price, client info
 */
export const RideCard: React.FC<RideCardProps> = ({
  _id,
  title,
  type,
  distance,
  estimatedPrice,
  client,
  onClick,
  thumbnail,
}) => {
  const getBadgeColor = () => {
    const colors: Record<string, string> = {
      mudanza: '#E5E7EB',
      electrodomésticos: '#F3F4F6',
      muebles: '#F9FAFB',
      productos: '#F3F4F6',
      otros: '#F3F4F6',
    }
    return colors[type] || '#F3F4F6'
  }

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header with title and distance */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
          gap: '0.75rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title.length > 50 ? `${title.substring(0, 47)}...` : title}
        </h3>
        <DistanceBadge distance={distance} />
      </div>

      {/* Type badge */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            backgroundColor: getBadgeColor(),
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}
        >
          {type}
        </span>
      </div>

      {/* Price and client info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        {/* Price */}
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          COP ${estimatedPrice.toLocaleString()}
        </span>

        {/* Client name and rating */}
        {client && (
          <span
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}
          >
            {client.firstName && (
              <>
                {client.firstName}
                {client.rating && ` ⭐ ${client.rating.toFixed(1)}`}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
