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

// Iconos específicos por estado — Material Symbols
const statusIcons: Record<string, string> = {
  requested: 'description',
  accepted: 'check_circle',
  in_progress: 'local_shipping',
  completed: 'task_alt',
  paid: 'payments',
  failed: 'error',
}

export function TimelineStepper({ steps, currentStatus, orientation = 'horizontal' }: TimelineStepperProps) {
  const currentIndex = statusOrder.indexOf(currentStatus)

  const getStepState = (_stepStatus: string, index: number) => {
    if (index < currentIndex) return 'completed'
    if (index === currentIndex) return 'active'
    return 'pending'
  }

  const getStepIcon = (stepStatus: string) => {
    return statusIcons[stepStatus] || 'radio_button_unchecked'
  }

  const getActiveAnimation = (stepStatus: string) => {
    // El camión rebota cuando está activo
    if (stepStatus === 'in_progress') return 'timeline-truck-active'
    return 'timeline-step-active'
  }

  if (orientation === 'vertical') {
    return (
      <div role="list" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
      }}>
        {steps.map((step, index) => {
          const state = getStepState(step.status, index)
          const isLast = index === steps.length - 1
          const icon = getStepIcon(step.status)

          return (
            <div
              key={step.status}
              role="listitem"
              aria-current={state === 'active' ? 'step' : undefined}
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
                  zIndex: 0,
                  animation: index < currentIndex
                    ? 'line-fill-vertical 0.6s var(--ease-out) forwards'
                    : undefined,
                }} />
              )}

              {/* Icon circle */}
              <div
                className={
                  state === 'active'
                    ? `${getActiveAnimation(step.status)} timeline-step-appear`
                    : ''
                }
                style={{
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
                }}
              >
                <span className="material-symbols-rounded" aria-hidden="true" style={{
                  fontSize: '1rem',
                  animation: state === 'active' && step.status === 'in_progress'
                    ? 'truck-bounce 1.2s ease-in-out infinite'
                    : undefined,
                }}>
                  {state === 'completed' ? 'check' : icon}
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
    <div role="list" style={{
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
        const icon = getStepIcon(step.status)

        return (
          <div
            key={step.status}
            role="listitem"
            aria-current={state === 'active' ? 'step' : undefined}
            className={state === 'active' ? 'timeline-step-appear' : ''}
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
                animation: index < currentIndex
                  ? 'line-fill-horizontal 0.6s var(--ease-out) forwards'
                  : undefined,
              }} />
            )}

            {/* Icon circle */}
            <div
              className={
                state === 'active'
                  ? `${getActiveAnimation(step.status)}`
                  : ''
              }
              style={{
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
              }}
            >
              <span className="material-symbols-rounded" aria-hidden="true" style={{
                fontSize: '0.875rem',
                animation: state === 'active' && step.status === 'in_progress'
                  ? 'truck-bounce 1.2s ease-in-out infinite'
                  : undefined,
              }}>
                {state === 'completed' ? 'check' : icon}
              </span>
            </div>

            {/* Label */}
            <span style={{
              fontSize: 'var(--text-xs)',
              fontWeight: state === 'active' ? 'var(--font-semibold)' : 'var(--font-medium)',
              color: state === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
              marginTop: 'var(--space-2)',
              textAlign: 'center',
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
