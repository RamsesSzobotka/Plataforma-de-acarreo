import { useEffect, useRef } from 'react'
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
  position: { x: number; y: number }
}

function DriverProfilePopup({ driverUser, driver, rideId, onClose, position }: DriverProfilePopupProps) {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  const popupHeight = 280
  const popupWidth = 260
  const arrowHeight = 8
  const padding = 12

  const adjustedPosition = (() => {
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    let x = position.x
    let y = position.y

    if (x + popupWidth + padding > viewportWidth) {
      x = viewportWidth - popupWidth - padding
    }
    if (x < padding) {
      x = padding
    }

    if (y + popupHeight + arrowHeight > viewportHeight) {
      y = position.y - popupHeight - arrowHeight
    }
    if (y < padding) {
      y = padding
    }

    return { x, y }
  })()

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

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
      {/* Backdrop to capture clicks */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
        }}
        onClick={onClose}
      />
      {/* Menu card */}
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: `${adjustedPosition.y}px`,
          left: `${adjustedPosition.x}px`,
          zIndex: 1000,
          minWidth: '200px',
          maxWidth: '260px',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Arrow */}
        <div style={{
          position: 'absolute',
          ...(adjustedPosition.y < position.y ? { bottom: '-6px' } : { top: '-6px' }),
          left: '24px',
          width: '12px',
          height: '12px',
          background: 'var(--surface-card)',
          borderLeft: '1px solid var(--border)',
          borderBottom: adjustedPosition.y < position.y ? '1px solid var(--border)' : 'none',
          borderRight: 'none',
          borderTop: adjustedPosition.y < position.y ? 'none' : '1px solid var(--border)',
          transform: 'rotate(45deg)',
          zIndex: -1,
        }} />

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
