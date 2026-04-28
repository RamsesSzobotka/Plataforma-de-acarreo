import React from 'react'

interface VerificationStatusProps {
  status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended' | null
  rejectionReason?: string
  onEditProfile: () => void
  onBypass?: () => void // Dev only
}

/**
 * Verification status component - shows blocking modal for unverified drivers
 */
export const VerificationStatus: React.FC<VerificationStatusProps> = ({
  status,
  rejectionReason,
  onEditProfile,
  onBypass,
}) => {
  if (status === 'verified' || status === null) {
    return null
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
      case 'in_review':
        return {
          title: '⚠️ Verificación Pendiente',
          message: 'Sus documentos están en revisión. No podrá aceptar encargos hasta que un admin apruebe su perfil.',
          subMessage: 'Tiempo estimado: 24-48 horas',
          bgColor: '#FEF3C7',
          borderColor: '#F59E0B',
          textColor: '#78350F',
        }
      case 'rejected':
        return {
          title: '❌ Verificación Rechazada',
          message: `Motivo: ${rejectionReason || 'No especificado'}`,
          subMessage: 'Por favor corrija los documentos y vuelva a enviar.',
          bgColor: '#FEE2E2',
          borderColor: '#EF4444',
          textColor: '#7F1D1D',
        }
      case 'suspended':
        return {
          title: '🚫 Cuenta Suspendida',
          message: 'Su cuenta ha sido suspendida. Contacte a soporte.',
          subMessage: '',
          bgColor: '#FEE2E2',
          borderColor: '#DC2626',
          textColor: '#7F1D1D',
        }
      default:
        return {
          title: 'Estado Desconocido',
          message: 'No se pudo determinar el estado de verificación.',
          subMessage: '',
          bgColor: '#F3F4F6',
          borderColor: '#D1D5DB',
          textColor: '#374151',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius)',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          border: `2px solid ${config.borderColor}`,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header with colored background */}
        <div
          style={{
            backgroundColor: config.bgColor,
            borderRadius: 'var(--radius-sm)',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            textAlign: 'center',
            borderLeft: `4px solid ${config.borderColor}`,
          }}
        >
          <h2
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: config.textColor,
              fontFamily: 'var(--font-heading)',
            }}
          >
            {config.title}
          </h2>
          <p
            style={{
              margin: '0.5rem 0 0 0',
              fontSize: '0.875rem',
              color: config.textColor,
              opacity: 0.8,
            }}
          >
            {config.message}
          </p>
          {config.subMessage && (
            <p
              style={{
                margin: '0.5rem 0 0 0',
                fontSize: '0.75rem',
                color: config.textColor,
                opacity: 0.7,
              }}
            >
              {config.subMessage}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={onEditProfile}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary)'
            }}
          >
            {status === 'rejected' ? 'Corregir y Reenviar' : 'Editar Perfil'}
          </button>

          {/* Dev bypass button (if provided) */}
          {onBypass && process.env.NODE_ENV === 'development' && (
            <button
              onClick={onBypass}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#EF4444',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
                opacity: 0.7,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7'
              }}
            >
              🧪 Skip Verification (Dev Only)
            </button>
          )}
        </div>

        {/* Info text */}
        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Si tiene preguntas, contacte a nuestro equipo de soporte.
        </p>
      </div>
    </div>
  )
}
