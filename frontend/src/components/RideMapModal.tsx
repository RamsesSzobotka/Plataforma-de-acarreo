import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Ride } from '../types'

interface RideMapModalProps {
  rides: Ride[]
  driverLocation: { lat: number; lng: number } | null
  onClose: () => void
  onNavigate: (rideId: string) => void
}

function createRideMarkerIcon(imageUrl?: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 44px; height: 44px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      background: ${imageUrl ? `url(${imageUrl}) center/cover no-repeat` : 'var(--primary, #0D9488)'};
      cursor: pointer;
    "></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

function createDriverIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 36px; height: 36px;
      border-radius: 50%;
      background: #3B82F6;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    "><span class="material-symbols-rounded" style="font-size:18px;font-family:'Material Symbols Rounded'">my_location</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function MapContent({
  rides,
  driverLocation,
}: {
  rides: Ride[]
  driverLocation: { lat: number; lng: number } | null
}) {
  const map = useMap()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const points: [number, number][] = rides.map((r) => [
      r.pickupLocation.coordinates[1],
      r.pickupLocation.coordinates[0],
    ])

    if (driverLocation) {
      points.push([driverLocation.lat, driverLocation.lng])
    }

    if (points.length > 0) {
      map.fitBounds(points, { padding: [50, 50] })
    } else {
      map.setView([8.98, -79.52], 13)
    }
  }, [map, rides, driverLocation])

  if (!driverLocation) return null

  return createPortal(
    <button
      onClick={(e) => {
        e.stopPropagation()
        map.flyTo([driverLocation.lat, driverLocation.lng], 14)
      }}
      title="Mi ubicación"
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          zIndex: 1000,
          background: 'var(--primary, #0D9488)',
          border: 'none',
          borderRadius: '8px',
          padding: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-hover, #0F766E)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary, #0D9488)' }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: '20px', fontFamily: "'Material Symbols Rounded'" }}>
        my_location
      </span>
    </button>,
    map.getContainer(),
  )
}

export default function RideMapModal({ rides, driverLocation, onClose, onNavigate }: RideMapModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          background: 'rgba(0,0,0,0.5)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#FFFFFF',
          zIndex: 10000,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
        aria-label="Cerrar mapa"
      >
        <span className="material-symbols-rounded" style={{ fontSize: '24px', fontFamily: "'Material Symbols Rounded'" }}>close</span>
      </button>

      {/* Map wrapper — stops propagation so click doesn't close modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'calc(100% - 48px)',
          maxWidth: '1200px',
          height: 'calc(100vh - 80px)',
          maxHeight: '90vh',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <MapContainer
          center={[8.98, -79.52]}
          zoom={13}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Ride markers */}
          {rides.map((ride) => {
            const lat = ride.pickupLocation.coordinates[1]
            const lng = ride.pickupLocation.coordinates[0]
            const imageUrl = ride.images?.[0]?.url
            return (
              <Marker
                key={ride._id}
                position={[lat, lng]}
                icon={createRideMarkerIcon(imageUrl)}
                eventHandlers={{
                  click: () => onNavigate(ride._id),
                }}
              />
            )
          })}

          {/* Driver location marker */}
          {driverLocation && (
            <Marker
              position={[driverLocation.lat, driverLocation.lng]}
              icon={createDriverIcon()}
            />
          )}

          {/* Child component with useMap access */}
          <MapContent
            rides={rides}
            driverLocation={driverLocation}
          />
        </MapContainer>
      </div>
    </div>,
    document.body,
  )
}
