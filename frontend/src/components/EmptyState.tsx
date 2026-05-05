import React from 'react'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    href?: string
  }
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="empty-state" style={{
      padding: 'var(--space-12) var(--space-6)',
      animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
    }}>
      {/* Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
        color: 'var(--text-muted)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: 'var(--space-6)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-glow) inset',
      }}>
        <span className="material-symbols-rounded" style={{ fontSize: '2.5rem' }}>
          {icon}
        </span>
      </div>

      {/* Text */}
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-semibold)',
        color: 'var(--text-primary)',
        marginBottom: 'var(--space-2)',
      }}>
        {title}
      </h3>
      <p style={{
        color: 'var(--text-muted)',
        maxWidth: '360px',
        lineHeight: 1.6,
        marginBottom: 'var(--space-6)',
      }}>
        {description}
      </p>

      {/* Actions */}
      {action && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {action.href ? (
            <Link to={action.href} className="btn btn-primary">
              <span className="material-symbols-rounded">{action.label.includes('Nuevo') ? 'add' : 'arrow_forward'}</span>
              {action.label}
            </Link>
          ) : (
            <button onClick={action.onClick} className="btn btn-primary">
              <span className="material-symbols-rounded">{action.label.includes('Nuevo') ? 'add' : 'arrow_forward'}</span>
              {action.label}
            </button>
          )}

          {secondaryAction && (
            secondaryAction.href ? (
              <Link to={secondaryAction.href} className="btn btn-outline">
                {secondaryAction.label}
              </Link>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}

export default EmptyState