import { Link } from 'react-router-dom'
import { useNotifications } from '../contexts/NotificationsContext'

interface ChatButtonProps {
  rideId: string
  variant?: 'primary' | 'secondary' | 'outline'
  showText?: boolean
}

export default function ChatButton({ rideId, variant = 'outline', showText = true }: ChatButtonProps) {
  const { getUnreadCount } = useNotifications()
  const unreadCount = getUnreadCount(rideId)
  const hasUnread = unreadCount > 0

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    position: 'relative',
    textDecoration: 'none',
  }

  const variants = {
    primary: {
      background: 'var(--primary)',
      color: 'white',
      border: 'none',
    },
    secondary: {
      background: 'var(--secondary)',
      color: 'white',
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: 'var(--primary)',
      border: '1px solid var(--primary)',
    },
  }

  return (
    <Link
      to={`/chat/${rideId}`}
      className="btn"
      style={{
        ...baseStyles,
        ...variants[variant],
        padding: '0.5rem 1rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
        chat
      </span>
      {showText && (
        <span>Chat</span>
      )}
      
      {/* Badge de mensajes no leídos */}
      {hasUnread && (
        <span
          style={{
            position: 'absolute',
            top: variant === 'outline' ? '-4px' : '-6px',
            right: showText ? '-6px' : '-6px',
            minWidth: '18px',
            height: '18px',
            padding: '0 4px',
            borderRadius: '999px',
            background: 'var(--error)',
            color: 'white',
            fontSize: '0.625rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}