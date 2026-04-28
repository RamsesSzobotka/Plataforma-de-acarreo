import React from 'react'

interface RadiusSelectorProps {
  currentRadius: number
  onRadiusChange: (radius: number) => void
}

/**
 * Radius selector component for filtering nearby rides
 * Buttons: 5km | 10km | 25km | 50km
 */
export const RadiusSelector: React.FC<RadiusSelectorProps> = ({
  currentRadius,
  onRadiusChange,
}) => {
  const radii = [5, 10, 25, 50]

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '1rem 0',
      }}
    >
      {radii.map((radius) => (
        <button
          key={radius}
          onClick={() => onRadiusChange(radius)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor:
              currentRadius === radius ? 'var(--primary)' : 'var(--bg-tertiary)',
            color:
              currentRadius === radius ? 'white' : 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            if (currentRadius !== radius) {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
            }
          }}
          onMouseLeave={(e) => {
            if (currentRadius !== radius) {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
            }
          }}
        >
          {radius} km
        </button>
      ))}
    </div>
  )
}
