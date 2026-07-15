import React from 'react'

interface SectionHeaderProps {
  icon: string
  title: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'compact'
}

export function SectionHeader({ icon, title, description, action, variant = 'default' }: SectionHeaderProps) {
  const isCompact = variant === 'compact'

  return (
    <div
      className="section-header"
      style={{
        display: 'flex',
        alignItems: isCompact ? 'center' : 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        marginBottom: isCompact ? 'var(--space-4)' : 'var(--space-6)',
        paddingBottom: isCompact ? 'var(--space-3)' : 'var(--space-4)',
        borderBottom: isCompact ? '1px solid var(--border-subtle)' : 'none',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: isCompact ? 'var(--space-3)' : 'var(--space-4)',
      }}>
        {/* Icon */}
        <div style={{
          width: isCompact ? '36px' : '48px',
          height: isCompact ? '36px' : '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--primary-subtle) 0%, var(--surface-2) 100%)',
          color: 'var(--primary)',
          borderRadius: 'var(--radius)',
          flexShrink: 0,
          border: '1px solid var(--border-accent)',
        }}>
          <span className="material-symbols-rounded" style={{
            fontSize: isCompact ? '1.125rem' : '1.5rem',
          }}>
            {icon}
          </span>
        </div>

        {/* Text */}
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: isCompact ? 'var(--text-lg)' : 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}>
            {title}
          </h2>
          {description && (
            <p style={{
              color: 'var(--text-muted)',
              fontSize: isCompact ? 'var(--text-xs)' : 'var(--text-sm)',
              marginTop: 'var(--space-1)',
            }}>
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Action */}
      {action && (
        <div style={{ flexShrink: 0 }}>
          {action}
        </div>
      )}
    </div>
  )
}

export default SectionHeader