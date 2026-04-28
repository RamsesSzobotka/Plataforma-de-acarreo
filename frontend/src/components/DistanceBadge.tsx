import React from 'react'

interface DistanceBadgeProps {
  distance: number // in km
}

/**
 * Distance badge component for ride cards
 * Displays: "📍 3.2 km"
 */
export const DistanceBadge: React.FC<DistanceBadgeProps> = ({ distance }) => {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-muted)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.875rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      📍 {distance} km
    </span>
  )
}
