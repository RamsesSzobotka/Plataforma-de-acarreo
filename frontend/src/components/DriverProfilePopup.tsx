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
  element: HTMLElement
}

function DriverProfilePopup({ driverUser, driver, rideId, onClose }: DriverProfilePopupProps) {
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={onClose}
      />

      {/* Card centrada */}
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          width: '280px',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'scaleIn 0.15s ease-out',
          overflow: 'hidden',
        }}
      >
        {/* Driver preview */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-5) var(--space-5) var(--space-3)',
        }}>
          {driverUser.imageUrl ? (
            <img
              src={driverUser.imageUrl}
              alt={driverUser.firstName}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                border: '2px solid var(--primary-subtle)',
              }}
            />
          ) : (
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {driverUser.firstName} {driverUser.lastName}
            </div>
            {driver && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '0.875rem', color: 'var(--warning)' }}>
                  star
                </span>
                <span>{driver.rating || 0} ({driver.totalRides || 0} viajes)</span>
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ padding: 'var(--space-2) var(--space-3) var(--space-3)' }}>
          <button
            onClick={() => {
              onClose()
              navigate(`/profile/${driverUser.clerkId}`)
            }}
            className="btn btn-secondary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>person</span>
            Ver Perfil
          </button>

          {rideId && (
            <button
              onClick={() => {
                onClose()
                navigate(`/chat/${rideId}`)
              }}
              className="btn btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>chat</span>
              Enviar Mensaje
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default DriverProfilePopup
