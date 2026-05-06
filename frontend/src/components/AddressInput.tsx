import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
}

interface AddressInputProps {
  label: string
  placeholder: string
  value: string
  coordinates: [number, number] | null
  onAddressChange: (address: string) => void
  onCoordinatesChange: (coordinates: [number, number] | null) => void
  required?: boolean
}

interface MapSelection {
  coordinates: [number, number]
  address: string
}

const DEFAULT_CENTER: [number, number] = [8.9824, -79.5199]

const selectionIcon = L.divIcon({
  className: 'map-selection-icon',
  html: '<div style="width:18px;height:18px;border-radius:999px;background:rgba(14,165,233,0.95);border:3px solid #fff;box-shadow:0 8px 22px rgba(14,165,233,0.35);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
})

const currentLocationIcon = L.divIcon({
  className: 'map-current-location-icon',
  html: '<div style="width:16px;height:16px;border-radius:999px;background:rgba(34,197,94,0.95);border:3px solid #fff;box-shadow:0 8px 22px rgba(34,197,94,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
})

function MapClickHandler({ onPick }: { onPick: (coordinates: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lng, event.latlng.lat])
    }
  })

  return null
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])

  return null
}

async function reverseGeocode(coordinates: [number, number]) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates[1]}&lon=${coordinates[0]}`
    )

    if (!response.ok) {
      return `Lat ${coordinates[1].toFixed(6)}, Lng ${coordinates[0].toFixed(6)}`
    }

    const data = await response.json()
    return data.display_name || `Lat ${coordinates[1].toFixed(6)}, Lng ${coordinates[0].toFixed(6)}`
  } catch (error) {
    console.error('Error reverse geocoding address:', error)
    return `Lat ${coordinates[1].toFixed(6)}, Lng ${coordinates[0].toFixed(6)}`
  }
}

export default function AddressInput({
  label,
  placeholder,
  value,
  coordinates,
  onAddressChange,
  onCoordinatesChange,
  required = false
}: AddressInputProps) {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState('')
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null)
  const [draftSelection, setDraftSelection] = useState<MapSelection | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (coordinates) {
      setResults([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(() => {
      if (value.trim().length >= 4) {
        searchAddress(value)
      } else {
        setResults([])
        setShowDropdown(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [value, coordinates])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isMapOpen) {
      return
    }

    setMapError('')
    setMapLoading(true)

    if (!navigator.geolocation) {
      setMapLoading(false)
      setMapError('Tu navegador no soporta geolocalización.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const deviceLocation: [number, number] = [position.coords.longitude, position.coords.latitude]
        setCurrentLocation(deviceLocation)
        if (!draftSelection) {
          setMapCenter([deviceLocation[1], deviceLocation[0]])
        }
        setMapLoading(false)
      },
      () => {
        setMapError('No fue posible obtener la ubicación del dispositivo. Puedes seleccionar manualmente en el mapa.')
        setMapLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    )
  }, [isMapOpen])

  useEffect(() => {
    if (!isMapOpen) {
      return
    }

    if (draftSelection) {
      setMapCenter([draftSelection.coordinates[1], draftSelection.coordinates[0]])
      return
    }

    if (coordinates) {
      setMapCenter([coordinates[1], coordinates[0]])
      return
    }

    if (currentLocation) {
      setMapCenter([currentLocation[1], currentLocation[0]])
      return
    }

    setMapCenter(DEFAULT_CENTER)
  }, [draftSelection, currentLocation, coordinates, isMapOpen])

  async function searchAddress(query: string) {
    setLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=PA`
      )
      const data = await response.json()
      setResults(data)
      setShowDropdown(true)
    } catch (error) {
      console.error('Error searching address:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(result: NominatimResult) {
    setShowDropdown(false)
    setResults([])
    onAddressChange(result.display_name)
    onCoordinatesChange([parseFloat(result.lon), parseFloat(result.lat)])
  }

  function handleClear() {
    setResults([])
    setShowDropdown(false)
    onAddressChange('')
    onCoordinatesChange(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function openMap() {
    setMapError('')
    setDraftSelection(null)
    setMapCenter(coordinates ? [coordinates[1], coordinates[0]] : currentLocation ? [currentLocation[1], currentLocation[0]] : DEFAULT_CENTER)
    setIsMapOpen(true)
  }

  function closeMap() {
    setIsMapOpen(false)
    setMapError('')
  }

  async function handleMapPick(nextCoordinates: [number, number]) {
    setMapLoading(true)
    setMapError('')

    const address = await reverseGeocode(nextCoordinates)
    setDraftSelection({
      coordinates: nextCoordinates,
      address
    })
    setMapLoading(false)
  }

  async function useDeviceLocation() {
    if (!navigator.geolocation) {
      setMapError('Tu navegador no soporta geolocalización.')
      return
    }

    setMapLoading(true)
    setMapError('')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCoordinates: [number, number] = [position.coords.longitude, position.coords.latitude]
        setCurrentLocation(nextCoordinates)
        setMapCenter([nextCoordinates[1], nextCoordinates[0]])
        await handleMapPick(nextCoordinates)
      },
      () => {
        setMapLoading(false)
        setMapError('No pudimos acceder a la ubicación del dispositivo.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    )
  }

  function confirmMapSelection() {
    if (!draftSelection) {
      return
    }

    onAddressChange(draftSelection.address)
    onCoordinatesChange(draftSelection.coordinates)
    closeMap()
  }

  const selectedSummary = coordinates ? value : ''

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
        {label} {required && <span style={{ color: 'var(--error)' }}>*</span>}
      </label>

      {coordinates ? (
        <div style={{
          display: 'grid',
          gap: '0.75rem',
          padding: '0.9rem',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
          borderRadius: 'var(--radius)',
          border: '1px solid rgba(13, 148, 136, 0.35)',
          boxShadow: 'var(--shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--primary)', marginTop: '0.1rem' }}>
              location_on
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selectedSummary.length > 90 ? `${selectedSummary.substring(0, 90)}...` : selectedSummary}
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Coordenadas: {coordinates[1].toFixed(6)}, {coordinates[0].toFixed(6)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                padding: '0.35rem',
                color: 'var(--text-muted)',
                borderRadius: '999px'
              }}
              aria-label="Limpiar dirección"
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={openMap}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <span className="material-symbols-rounded">map</span>
            Cambiar en el mapa
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative', display: 'grid', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              className="input"
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                onAddressChange(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => results.length > 0 && setShowDropdown(true)}
              required={required}
            />

            {loading && (
              <span
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                <span className="material-symbols-rounded" style={{ animation: 'spin 1s linear infinite' }}>
                  sync
                </span>
              </span>
            )}

            {showDropdown && results.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-lg)',
                maxHeight: '220px',
                overflowY: 'auto',
                zIndex: 1000,
                marginTop: '0.35rem'
              }}>
                {results.map((result) => (
                  <button
                    key={result.place_id}
                    type="button"
                    onClick={() => handleSelect(result)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.85rem 0.9rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--secondary)', marginTop: '0.1rem' }}>
                        place
                      </span>
                      <span>
                        {result.display_name.length > 80
                          ? `${result.display_name.substring(0, 80)}...`
                          : result.display_name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={openMap}
              style={{ flex: '1 1 210px', justifyContent: 'center' }}
            >
              <span className="material-symbols-rounded">map</span>
              Elegir en el mapa
            </button>

            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Puedes buscar una dirección o seleccionar exactamente el punto en el mapa.
            </span>
          </div>
        </div>
      )}

      {isMapOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 3000,
          background: 'rgba(2, 6, 23, 0.72)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          padding: '1rem'
        }}>
          <div style={{
            width: 'min(1100px, 100%)',
            maxHeight: 'min(92vh, 920px)',
            overflow: 'auto',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '24px',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1.25rem 1.25rem 1rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.16)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                  <span className="material-symbols-rounded" style={{ color: 'var(--secondary)' }}>map</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Seleccionar {label.toLowerCase()}</h3>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                  Haz zoom, usa tu ubicación del dispositivo o toca un punto exacto para fijar la dirección.
                </p>
              </div>

              <button
                type="button"
                onClick={closeMap}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '999px',
                  width: '2.5rem',
                  height: '2.5rem',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer'
                }}
                aria-label="Cerrar mapa"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 0.9fr)',
              gap: '1rem',
              padding: '1rem',
              alignItems: 'stretch'
            }}>
              <div style={{ position: 'relative', minHeight: '520px', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <MapContainer
                  center={mapCenter}
                  zoom={15}
                  scrollWheelZoom
                  style={{ height: '100%', width: '100%', minHeight: '520px' }}
                >
                  <MapRecenter center={mapCenter} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickHandler onPick={handleMapPick} />
                  {draftSelection && <Marker position={[draftSelection.coordinates[1], draftSelection.coordinates[0]]} icon={selectionIcon} />}
                  {!draftSelection && coordinates && <Marker position={[coordinates[1], coordinates[0]]} icon={selectionIcon} />}
                  {currentLocation && <Marker position={[currentLocation[1], currentLocation[0]]} icon={currentLocationIcon} />}
                </MapContainer>

                {mapLoading && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(2, 6, 23, 0.26)',
                    color: 'white',
                    fontWeight: 600,
                    letterSpacing: '0.02em'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="material-symbols-rounded" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
                      Cargando ubicación...
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  borderRadius: '20px',
                  background: 'rgba(15, 23, 42, 0.82)',
                  border: '1px solid rgba(148, 163, 184, 0.16)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>my_location</span>
                    <strong>Ubicación actual</strong>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                    Si autorizas el navegador, verás la posición del dispositivo para seleccionar más rápido el punto de recogida o destino.
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={useDeviceLocation}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '0.9rem' }}
                  >
                    <span className="material-symbols-rounded">my_location</span>
                    Usar mi ubicación
                  </button>
                </div>

                <div style={{
                  padding: '1rem',
                  borderRadius: '20px',
                  background: 'rgba(30, 41, 59, 0.78)',
                  border: '1px solid rgba(148, 163, 184, 0.16)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--secondary)' }}>pin_drop</span>
                    <strong>Selección provisional</strong>
                  </div>
                  <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {draftSelection ? draftSelection.address : 'Toca en el mapa para marcar la dirección exacta.'}
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {draftSelection
                      ? `${draftSelection.coordinates[1].toFixed(6)}, ${draftSelection.coordinates[0].toFixed(6)}`
                      : 'Sin coordenadas seleccionadas todavía.'}
                  </div>
                </div>

                {mapError && (
                  <div style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '16px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.22)',
                    color: '#FCA5A5',
                    fontSize: '0.9rem'
                  }}>
                    {mapError}
                  </div>
                )}

                <div style={{ display: 'grid', gap: '0.75rem', marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirmMapSelection}
                    disabled={!draftSelection || mapLoading}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span className="material-symbols-rounded">check</span>
                    Usar esta ubicación
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={closeMap}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`\n        @keyframes spin {\n          from { transform: rotate(0deg); }\n          to { transform: rotate(360deg); }\n        }\n      `}</style>
    </div>
  )
}
