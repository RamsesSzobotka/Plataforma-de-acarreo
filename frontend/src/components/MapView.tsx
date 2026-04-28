import React from 'react'

interface Location {
  address: string
  coordinates: {
    type: 'Point'
    coordinates: [number, number] // [lng, lat]
  }
}

interface MapViewProps {
  pickupLocation?: Location
  dropoffLocation?: Location
  driverLocation?: { lat: number; lng: number }
}

/**
 * Map view component for ride details
 * 
 * Phase 1: Placeholder showing coordinates
 * Phase 2: Integration with Google Maps or Leaflet
 */
export const MapView: React.FC<MapViewProps> = ({
  pickupLocation,
  dropoffLocation,
  driverLocation,
}) => {
  const extractCoordinates = (location?: Location) => {
    if (!location?.coordinates.coordinates) return null
    const [lng, lat] = location.coordinates.coordinates
    return { lat, lng }
  }

  const pickup = extractCoordinates(pickupLocation)
  const dropoff = extractCoordinates(dropoffLocation)

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.5rem',
        marginTop: '1.5rem',
      }}
    >
      <h3
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        📍 Ubicaciones
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}
      >
        {/* Pickup location */}
        <div>
          <p
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            🚚 Recogida
          </p>
          <p
            style={{
              margin: '0.5rem 0',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
            }}
          >
            {pickupLocation?.address}
          </p>
          {pickup && (
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
            </p>
          )}
        </div>

        {/* Dropoff location */}
        <div>
          <p
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            ✓ Entrega
          </p>
          <p
            style={{
              margin: '0.5rem 0',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
            }}
          >
            {dropoffLocation?.address}
          </p>
          {dropoff && (
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
            </p>
          )}
        </div>
      </div>

      {/* Placeholder for map */}
      <div
        style={{
          marginTop: '1rem',
          backgroundColor: 'white',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          height: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          fontStyle: 'italic',
        }}
      >
        📍 Mapa (próximamente en Phase 2)
      </div>
    </div>
  )
}
