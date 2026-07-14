import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface DriverProfilePopupProps {
  driverUser: {
    clerkId?: string
    firstName?: string
    lastName?: string
    imageUrl?: string
  } | null
  driver: {
    rating?: number
    totalRides?: number
  } | null
  rideId?: string
  onClose: () => void
  element: HTMLElement
}

interface Position {
  top: number
  left: number
  arrowUp: boolean
}

function DriverProfilePopup({ driverUser, driver, rideId, onClose, element }: DriverProfilePopupProps) {
  const navigate = useNavigate()
  const popupRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  // ── Calcular posición después del primer render (cuando el DOM existe) ──
  useEffect(() => {
    const popup = popupRef.current
    if (!popup) return

    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const elRect = element.getBoundingClientRect()
    const popupW = popup.offsetWidth
    const popupH = popup.offsetHeight
    const gap = 8

    // Por defecto: abajo del elemento
    let top = elRect.bottom + gap
    let arrowUp = true

    // Si no cabe abajo, arriba del elemento
    if (top + popupH > viewportH) {
      top = elRect.top - popupH - gap
      arrowUp = false
    }

    // Centrar horizontalmente respecto al elemento, sin salirse del viewport
    let left = elRect.left + elRect.width / 2 - popupW / 2
    const padding = 12
    if (left < padding) left = padding
    if (left + popupW > viewportW - padding) left = viewportW - popupW - padding

    setPosition({ top, left, arrowUp })
  }, [element])

  // ── Cerrar al hacer click fuera ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // ── Cerrar con Escape ──
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // ── Recalcular al hacer scroll/resize ──
  useEffect(() => {
    function handleReposition() {
      setPosition(null)
      // El useEffect de arriba se corre de nuevo porque position cambió
    }
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [element])

  if (!driverUser) return null

  const initials = [driverUser.firstName, driverUser.lastName]
    .filter((n): n is string => !!n)
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase() || 'D'

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className="material-symbols-rounded"
        style={{
          fontSize: '0.75rem',
          color: i < Math.round(rating) ? 'var(--warning)' : 'var(--border)',
          fontVariationSettings: i < Math.round(rating) ? "'FILL' 1" : "'FILL' 0",
        }}
      >
        star
      </span>
    ))
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Popup */}
      <div
        ref={popupRef}
        style={{
          position: 'fixed',
          top: position ? `${position.top}px` : '-9999px',
          left: position ? `${position.left}px` : '-9999px',
          zIndex: 1000,
          minWidth: '200px',
          maxWidth: '280px',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          opacity: position ? 1 : 0,
          transition: 'opacity 0.15s ease-out',
        }}
      >
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            width: '12px',
            height: '12px',
            background: 'var(--surface-card)',
            borderLeft: '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
            transform: 'rotate(45deg)',
            zIndex: -1,
            left: '20px',
            top: position?.arrowUp ? '-6px' : undefined,
            bottom: !position?.arrowUp ? '-6px' : undefined,
          }}
        />

        {/* Driver preview */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {driverUser.imageUrl ? (
            <img
              src={driverUser.imageUrl}
              alt={driverUser.firstName}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-bold)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {driverUser.firstName} {driverUser.lastName}
            </div>
            {driver ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}>
                <div style={{ display: 'flex' }}>
                  {renderStars(driver.rating || 0)}
                </div>
                <span>{driver.rating || 0} ({driver.totalRides || 0})</span>
              </div>
            ) : (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Sin calificaciones
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: 'var(--space-2)' }}>
          <button
            onClick={() => {
              onClose()
              navigate(`/profile/${driverUser.clerkId}`)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              width: '100%',
              padding: 'var(--space-2) var(--space-3)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.125rem', color: 'var(--primary)' }}>person</span>
            Ver Perfil
          </button>

          {rideId && (
            <button
              onClick={() => {
                onClose()
                navigate(`/chat/${rideId}`)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1.125rem', color: 'var(--secondary)' }}>chat</span>
              Enviar Mensaje
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default DriverProfilePopup
