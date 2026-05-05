import React from 'react'

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig: Record<string, { label: string; icon: string; variant: string }> = {
  // Ride statuses
  requested: { label: 'Pendiente', icon: 'inbox', variant: 'info' },
  negotiating: { label: 'Negociando', icon: 'chat', variant: 'warning' },
  accepted: { label: 'Aceptado', icon: 'check_circle', variant: 'primary' },
  in_progress: { label: 'En Viaje', icon: 'delivery_truck_speed', variant: 'primary' },
  completed: { label: 'Completado', icon: 'task_alt', variant: 'success' },
  paid: { label: 'Pagado', icon: 'payments', variant: 'success' },
  cancelled: { label: 'Cancelado', icon: 'cancel', variant: 'error' },

  // Driver verification statuses
  pending: { label: 'Pendiente', icon: 'pending', variant: 'warning' },
  in_review: { label: 'En Revision', icon: 'visibility', variant: 'info' },
  verified: { label: 'Verificado', icon: 'verified', variant: 'success' },
  rejected: { label: 'Rechazado', icon: 'error', variant: 'error' },
  suspended: { label: 'Suspendido', icon: 'block', variant: 'error' },

  // Default
  default: { label: 'Sin estado', icon: 'help', variant: 'neutral' },
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'var(--primary-subtle)',
    color: 'var(--primary-light)',
    border: '1px solid var(--primary-glow)',
  },
  success: {
    background: 'var(--success-subtle)',
    color: 'var(--success)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
  },
  warning: {
    background: 'var(--warning-subtle)',
    color: 'var(--warning)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
  },
  error: {
    background: 'var(--error-subtle)',
    color: 'var(--error)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  info: {
    background: 'var(--info-subtle)',
    color: 'var(--info)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  neutral: {
    background: 'var(--surface-2)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
}

const sizeStyles = {
  sm: { padding: '2px 8px', fontSize: '0.7rem', gap: '4px' },
  md: { padding: '4px 12px', fontSize: '0.8rem', gap: '6px' },
  lg: { padding: '6px 16px', fontSize: '0.875rem', gap: '8px' },
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.default

  return (
    <span
      className="badge"
      style={{
        ...variantStyles[config.variant],
        ...sizeStyles[size],
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles[size].gap,
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 'inherit' }}>
        {config.icon}
      </span>
      {config.label}
    </span>
  )
}

export default StatusBadge