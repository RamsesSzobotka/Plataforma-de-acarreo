import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteResult, Coordinates } from '../../services/osrm'
import { getRoute } from '../../services/osrm'

interface RouteMapProps {
  pickup: {
    address: string
    coordinates: Coordinates
  }
  dropoff: {
    address: string
    coordinates: Coordinates
  }
  /** Ubicación en vivo del conductor */
  driverLocation?: {
    latitude: number
    longitude: number
    heading?: number
  } | null
}

interface MapViewProps {
  pickup: RouteMapProps['pickup']
  dropoff: RouteMapProps['dropoff']
  route: RouteResult | null
  userLocation: [number, number] | null
  pickupIcon: L.DivIcon
  dropoffIcon: L.DivIcon
  polylinePositions: [number, number][] | null
  height: string
  resetKey: number
  showLocationBtn?: boolean
  showResetBtn?: boolean
  onLocationResult?: (coords: [number, number] | null) => void
  onResetView?: () => void
  /** Ubicación en vivo del conductor */
  driverLocation?: { latitude: number; longitude: number; heading?: number } | null
  /** Icono de camión para el marcador del conductor */
  truckIcon: L.DivIcon
}

function createMarkerIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      color: white;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Plus Jakarta Sans', sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      white-space: nowrap;
    ">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/** Icono de camión para el marcador del conductor en vivo */
function createTruckIcon(): L.DivIcon {
  return L.divIcon({
    className: 'driver-truck-marker',
    html: `<div style="
      width: 40px;
      height: 40px;
      background: #0D9488;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 3px solid white;
      color: white;
      font-size: 20px;
      font-family: 'Material Symbols Rounded';
      transform: translate(-50%, -50%);
    ">local_shipping</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

function MapBoundsFitter({
  pickup,
  dropoff,
  resetKey,
}: {
  pickup: Coordinates
  dropoff: Coordinates
  resetKey: number
}) {
  const map = useMap()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
    }
    // Run fitBounds on first mount AND whenever resetKey changes
    if (pickup.lat === dropoff.lat && pickup.lng === dropoff.lng) {
      map.setView([pickup.lat, pickup.lng], 15)
    } else {
      map.fitBounds(
        [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ],
        { padding: [50, 50] },
      )
    }
  }, [resetKey]) // Only depend on resetKey

  return null
}

/**
 * Vuela a la ubicación del usuario cuando se detecta.
 * Se renderiza dentro de MapContainer para acceder a useMap().
 */
function LocationFlyTo({ location }: { location: [number, number] | null }) {
  const map = useMap()
  const prevLocation = useRef(location)

  useEffect(() => {
    if (location && (
      !prevLocation.current ||
      prevLocation.current[0] !== location[0] ||
      prevLocation.current[1] !== location[1]
    )) {
      map.flyTo(location, 15, { duration: 1 })
    }
    prevLocation.current = location
  }, [location, map])

  return null
}

/**
 * Extracted map content — used in both the inline map and the modal.
 * Renders MapContainer with all children (tiles, markers, polyline, user location).
 */
function MapView({
  pickup,
  dropoff,
  route,
  userLocation,
  pickupIcon,
  dropoffIcon,
  polylinePositions,
  height,
  resetKey,
  showLocationBtn = true,
  showResetBtn = false,
  onLocationResult,
  onResetView,
  driverLocation,
  truckIcon,
}: MapViewProps) {
  const [localLocationError, setLocalLocationError] = useState<string | null>(null)
  const midPoint = useMemo(() => ({
    lat: (pickup.coordinates.lat + dropoff.coordinates.lat) / 2,
    lng: (pickup.coordinates.lng + dropoff.coordinates.lng) / 2,
  }), [pickup.coordinates, dropoff.coordinates])

  const handleLocationClick = useCallback(() => {
    // If already have a location, clear it first then re-fetch
    if (userLocation) {
      onLocationResult?.(null)
    }

    if (!navigator.geolocation) {
      setLocalLocationError('Geolocalización no disponible')
      setTimeout(() => setLocalLocationError(null), 3000)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationResult?.([pos.coords.latitude, pos.coords.longitude])
        setLocalLocationError(null)
      },
      () => {
        setLocalLocationError('No se pudo obtener tu ubicación')
        setTimeout(() => setLocalLocationError(null), 3000)
      },
    )
  }, [userLocation, onLocationResult])

  return (
    <MapContainer
      center={[midPoint.lat, midPoint.lng]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ height, width: '100%', zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <MapBoundsFitter
        pickup={pickup.coordinates}
        dropoff={dropoff.coordinates}
        resetKey={resetKey}
      />

      {/* Vuela a la ubicación del usuario cuando se detecta */}
      <LocationFlyTo location={userLocation} />

      <Marker position={[pickup.coordinates.lat, pickup.coordinates.lng]} icon={pickupIcon} />
      <Marker position={[dropoff.coordinates.lat, dropoff.coordinates.lng]} icon={dropoffIcon} />

      {polylinePositions && polylinePositions.length > 1 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={
            route?.isFallback
              ? {
                  color: '#94A3B8',
                  weight: 3,
                  opacity: 0.8,
                  dashArray: '10, 10',
                }
              : {
                  color: '#0D9488',
                  weight: 4,
                  opacity: 0.8,
                }
          }
        />
      )}

      {userLocation && (
        <CircleMarker
          center={userLocation}
          radius={8}
          pathOptions={{
            color: '#FFFFFF',
            fillColor: '#3B82F6',
            fillOpacity: 0.6,
            weight: 2,
          }}
        />
      )}

      {/* Marcador del conductor en vivo (tracking) */}
      {driverLocation && (
        <Marker
          position={[driverLocation.latitude, driverLocation.longitude]}
          icon={truckIcon}
        />
      )}

      {/* Control buttons — bottom-right of map */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {showLocationBtn && (
          <button
            onClick={(e) => { e.stopPropagation(); handleLocationClick() }}
            title="Mi ubicación"
            style={{
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
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-hover, #0F766E)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary, #0D9488)' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px', fontFamily: "'Material Symbols Rounded'" }}>
              my_location
            </span>
          </button>
        )}

        {showResetBtn && (
          <button
            onClick={(e) => { e.stopPropagation(); onResetView?.() }}
            title="Reiniciar vista"
            style={{
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
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-hover, #0F766E)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary, #0D9488)' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px', fontFamily: "'Material Symbols Rounded'" }}>
              center_focus_strong
            </span>
          </button>
        )}
      </div>

      {/* Location error toast */}
      {localLocationError && (
        <div
          style={{
            position: 'absolute',
            bottom: '96px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#EF4444',
            color: '#FFFFFF',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {localLocationError}
        </div>
      )}
    </MapContainer>
  )
}

/**
 * Full-screen modal that renders an expanded version of the map via portal.
 */
function RouteMapModal({
  pickup,
  dropoff,
  route,
  userLocation,
  pickupIcon,
  dropoffIcon,
  polylinePositions,
  resetKey,
  showLocationBtn,
  showResetBtn,
  onLocationResult,
  onResetView,
  onClose,
  driverLocation,
  truckIcon,
}: Omit<MapViewProps, 'height'> & { onClose: () => void }) {
  // Prevent body scroll and handle Escape key
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
        animation: 'rtmFadeIn 0.2s ease',
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
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
        aria-label="Cerrar mapa"
      >
        <span className="material-symbols-rounded" style={{ fontSize: '24px', fontFamily: "'Material Symbols Rounded'" }}>close</span>
      </button>

      {/* Map wrapper */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'calc(100% - 48px)',
          maxWidth: '1200px',
          height: 'calc(100% - 48px)',
          maxHeight: '90vh',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <MapView
          pickup={pickup}
          dropoff={dropoff}
          route={route}
          userLocation={userLocation}
          pickupIcon={pickupIcon}
          dropoffIcon={dropoffIcon}
          polylinePositions={polylinePositions}
          height="100%"
          resetKey={resetKey}
          showLocationBtn={showLocationBtn}
          showResetBtn={showResetBtn}
          onLocationResult={onLocationResult}
          onResetView={onResetView}
          driverLocation={driverLocation}
          truckIcon={truckIcon}
        />
      </div>

      {/* Distance badge inside modal */}
      {route && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '8px',
            padding: '6px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 600,
            fontSize: '14px',
            color: '#0F172A',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#0D9488', fontFamily: "'Material Symbols Rounded'" }}>
            route
          </span>
          {route.distanceKm.toFixed(1)} km · {Math.round(route.durationMin)} min
        </div>
      )}

      {/* Fade-in keyframes */}
      <style>{`
        @keyframes rtmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  )
}

export function RouteMap({ pickup, dropoff, driverLocation }: RouteMapProps) {
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [resetKey, setResetKey] = useState(0)

  const hasValidCoordinates =
    pickup.coordinates &&
    dropoff.coordinates &&
    typeof pickup.coordinates.lat === 'number' &&
    typeof pickup.coordinates.lng === 'number' &&
    typeof dropoff.coordinates.lat === 'number' &&
    typeof dropoff.coordinates.lng === 'number'

  const pickupIcon = useMemo(() => createMarkerIcon('#22C55E', 'Recogida'), [])
  const dropoffIcon = useMemo(() => createMarkerIcon('#EF4444', 'Destino'), [])
  const truckIcon = useMemo(() => createTruckIcon(), [])

  useEffect(() => {
    // Solo ejecutar si las coordenadas son válidas (no necesita ser dependencia porque
    // pickup.coordinates y dropoff.coordinates YA son las dependencias reales)
    if (!hasValidCoordinates) {
      setLoading(false)
      setRoute(null)
      return
    }

    let cancelled = false
    setLoading(true)

    getRoute(pickup.coordinates, dropoff.coordinates).then((result) => {
      if (!cancelled) {
        setRoute(result)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
    // Las dependencias correctas son las coordenadas, NO hasValidCoordinates que se recalcula en cada render
  }, [pickup.coordinates, dropoff.coordinates])

  const handleLocationResult = useCallback((coords: [number, number] | null) => {
    setUserLocation(coords)
  }, [])

  const handleResetView = useCallback(() => {
    setResetKey((k) => k + 1)
  }, [])

  // Missing coordinates placeholder
  if (!hasValidCoordinates) {
    return (
      <div
        style={{
          height: '300px',
          width: '100%',
          borderRadius: '12px',
          background: 'var(--bg-secondary, #F8FAFC)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '0.5rem',
          color: 'var(--text-muted, #64748B)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '14px',
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '2rem', opacity: 0.5, fontFamily: "'Material Symbols Rounded'" }}>
          map
        </span>
        <span>Ubicaciones no disponibles</span>
      </div>
    )
  }

  const polylinePositions: [number, number][] | null =
    route && route.coordinates.length > 0
      ? (route.coordinates as [number, number][])
      : null

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${pickup.coordinates.lat},${pickup.coordinates.lng}&destination=${dropoff.coordinates.lat},${dropoff.coordinates.lng}`

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: '300px',
          width: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
          cursor: 'pointer',
        }}
        onClick={() => setModalOpen(true)}
      >
        <MapView
          pickup={pickup}
          dropoff={dropoff}
          route={route}
          userLocation={userLocation}
          pickupIcon={pickupIcon}
          dropoffIcon={dropoffIcon}
          polylinePositions={polylinePositions}
          height="300px"
          resetKey={resetKey}
          showLocationBtn={true}
          showResetBtn={false}
          onLocationResult={handleLocationResult}
          onResetView={handleResetView}
          driverLocation={driverLocation}
          truckIcon={truckIcon}
        />

        {/* Loading overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              borderRadius: '12px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-muted, #64748B)',
              pointerEvents: 'none',
            }}
          >
            Cargando ruta...
          </div>
        )}

        {/* Distance badge */}
        {route && !loading && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'var(--bg-primary, #FFFFFF)',
              borderRadius: '8px',
              padding: '6px 12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
              fontSize: '14px',
              color: '#0F172A',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              pointerEvents: 'none',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '16px', color: 'var(--primary, #0D9488)', fontFamily: "'Material Symbols Rounded'" }}>
              route
            </span>
            {route.distanceKm.toFixed(1)} km · {Math.round(route.durationMin)} min
          </div>
        )}

      </div>

      {/* "Abrir en Google Maps" button */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--primary, #0D9488)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
          marginTop: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          transition: 'background 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-tertiary, #F1F5F9)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '18px', fontFamily: "'Material Symbols Rounded'" }}>
          map
        </span>
        Abrir en Google Maps
      </a>

      {/* Full-screen modal */}
      {modalOpen && (
        <RouteMapModal
          pickup={pickup}
          dropoff={dropoff}
          route={route}
          userLocation={userLocation}
          pickupIcon={pickupIcon}
          dropoffIcon={dropoffIcon}
          polylinePositions={polylinePositions}
          resetKey={resetKey}
          showLocationBtn={true}
          showResetBtn={true}
          onLocationResult={handleLocationResult}
          onResetView={handleResetView}
          onClose={() => setModalOpen(false)}
          driverLocation={driverLocation}
          truckIcon={truckIcon}
        />
      )}
    </div>
  )
}

export default RouteMap
