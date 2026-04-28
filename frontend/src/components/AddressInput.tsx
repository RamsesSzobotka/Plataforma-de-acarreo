import { useState, useEffect, useRef } from 'react'

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
  const [selected, setSelected] = useState<NominatimResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounce para búsqueda
  useEffect(() => {
    if (selected) return

    const timer = setTimeout(() => {
      if (value.length >= 4) {
        searchAddress(value)
      } else {
        setResults([])
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [value])

  // Cerrar dropdown al hacer click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function searchAddress(query: string) {
    setLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=PA`,
        {
          headers: {
            'User-Agent': 'PlataformaDeAcarreos/1.0'
          }
        }
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
    setSelected(result)
    onAddressChange(result.display_name)
    onCoordinatesChange([parseFloat(result.lon), parseFloat(result.lat)])
    setShowDropdown(false)
    setResults([])
  }

  function handleClear() {
    setSelected(null)
    onAddressChange('')
    onCoordinatesChange(null)
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
        {label} {required && '*'}
      </label>
      
      {selected ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--primary)'
        }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>
            location_on
          </span>
          <span style={{ flex: 1, fontSize: '0.9rem' }}>
            {selected.display_name.length > 50 
              ? selected.display_name.substring(0, 50) + '...' 
              : selected.display_name}
          </span>
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: 'var(--text-muted)'
            }}
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onAddressChange(e.target.value)
              setSelected(null)
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
              boxShadow: 'var(--shadow)',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000,
              marginTop: '4px'
            }}>
              {results.map((result) => (
                <button
                  key={result.place_id}
                  type="button"
                  onClick={() => handleSelect(result)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.75rem',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--secondary)' }}>
                      place
                    </span>
                    {result.display_name.length > 60 
                      ? result.display_name.substring(0, 60) + '...' 
                      : result.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}