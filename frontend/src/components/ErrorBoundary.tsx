import { Component, ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary, #0F172A)',
            padding: '2rem',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              maxWidth: '420px',
              animation: 'fadeInUp 0.4s ease-out',
            }}
          >
            {/* Logo icon */}
            <div
              style={{
                width: '88px',
                height: '88px',
                margin: '0 auto 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--surface-1, #1E293B) 0%, var(--surface-2, #334155) 100%)',
                borderRadius: 'var(--radius-xl, 16px)',
                border: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.15))',
                boxShadow: 'var(--shadow-glow, 0 0 20px rgba(13, 148, 136, 0.1)) inset',
              }}
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: '2.75rem',
                  color: 'var(--primary, #0D9488)',
                }}
              >
                local_shipping
              </span>
            </div>

            {/* Heading */}
            <h1
              style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: 'var(--text-xl, 1.5rem)',
                fontWeight: 700,
                color: 'var(--text-primary, #F8FAFC)',
                marginBottom: '0.75rem',
              }}
            >
              Algo salio mal
            </h1>

            <p
              style={{
                color: 'var(--text-muted, #94A3B8)',
                fontSize: 'var(--text-sm, 0.875rem)',
                lineHeight: 1.6,
                marginBottom: '1rem',
              }}
            >
              Ocurrio un error inesperado. Nuestro equipo ha sido notificado.
            </p>

            {/* Error details (collapsible feel — truncated for non-technical users) */}
            {this.state.error && (
              <div
                style={{
                  background: 'var(--surface-1, #1E293B)',
                  borderRadius: 'var(--radius, 12px)',
                  border: '1px solid var(--border, rgba(148, 163, 184, 0.2))',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.5rem',
                  textAlign: 'left',
                }}
              >
                <p
                  style={{
                    color: 'var(--error, #EF4444)',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    wordBreak: 'break-word',
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>arrow_back</span>
                Volver al inicio
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-outline"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>refresh</span>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
