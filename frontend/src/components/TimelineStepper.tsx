import { StatusBadge } from './StatusBadge'

interface TimelineStep {
  status: string
  label: string
  time?: string
  description?: string
}

interface TimelineStepperProps {
  steps: TimelineStep[]
  currentStatus: string
  orientation?: 'horizontal' | 'vertical'
}

const statusOrder = [
  'requested',
  'accepted',
  'in_progress',
  'completed',
  'paid',
  'failed',
]

export function TimelineStepper({ steps, currentStatus, orientation = 'horizontal' }: TimelineStepperProps) {
  const currentIndex = statusOrder.indexOf(currentStatus)

  const getStepState = (_stepStatus: string, index: number) => {
    if (index < currentIndex) return 'completed'
    if (index === currentIndex) return 'active'
    return 'pending'
  }

  if (orientation === 'vertical') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
      }}>
        {steps.map((step, index) => {
          const state = getStepState(step.status, index)
          const isLast = index === steps.length - 1

          return (
            <div
              key={step.status}
              style={{
                display: 'flex',
                gap: 'var(--space-4)',
                position: 'relative',
                paddingBottom: isLast ? 0 : 'var(--space-6)',
              }}
            >
              {/* Line connector */}
              {!isLast && (
                <div style={{
                  position: 'absolute',
                  left: '15px',
                  top: '32px',
                  bottom: 0,
                  width: '2px',
                  background: index < currentIndex
                    ? 'var(--primary)'
                    : 'var(--surface-2)',
                }} />
              )}

              {/* Icon */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                zIndex: 1,
                background: state === 'completed'
                  ? 'var(--success)'
                  : state === 'active'
                    ? 'var(--primary)'
                    : 'var(--surface-2)',
                color: state === 'pending' ? 'var(--text-muted)' : 'white',
                boxShadow: state === 'active' ? '0 0 16px var(--primary-glow)' : 'none',
                transition: 'all var(--duration-normal) var(--ease-out)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                  {state === 'completed' ? 'check' : state === 'active' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingTop: '4px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: state === 'active' ? 'var(--font-semibold)' : 'var(--font-medium)',
                    color: state === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>
                    {step.label}
                  </span>
                  {step.time && (
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {step.time}
                    </span>
                  )}
                </div>
                {step.description && state !== 'pending' && (
                  <p style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--space-1)',
                  }}>
                    {step.description}
                  </p>
                )}
                {state === 'active' && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <StatusBadge status={currentStatus} size="sm" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Horizontal orientation
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--space-2)',
      overflowX: 'auto',
      padding: 'var(--space-2) 0',
    }}>
      {steps.map((step, index) => {
        const state = getStepState(step.status, index)
        const isLast = index === steps.length - 1

        return (
          <div
            key={step.status}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              minWidth: '100px',
              position: 'relative',
            }}
          >
            {/* Connector line */}
            {!isLast && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '50%',
                right: '-50%',
                height: '2px',
                background: index < currentIndex
                  ? 'var(--primary)'
                  : 'var(--surface-2)',
                zIndex: 0,
              }} />
            )}

            {/* Icon */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: state === 'completed'
                ? 'var(--success)'
                : state === 'active'
                  ? 'var(--primary)'
                  : 'var(--surface-2)',
              color: state === 'pending' ? 'var(--text-muted)' : 'white',
              boxShadow: state === 'active' ? '0 0 16px var(--primary-glow)' : 'none',
              zIndex: 1,
              transition: 'all var(--duration-normal) var(--ease-out)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>
                {state === 'completed' ? 'check' : state === 'active' ? 'radio_button_checked' : 'radio_button_unchecked'}
              </span>
            </div>

            {/* Label */}
            <span style={{
              fontSize: 'var(--text-xs)',
              fontWeight: state === 'active' ? 'var(--font-semibold)' : 'var(--font-medium)',
              color: state === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
              marginTop: 'var(--space-2)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default TimelineStepper