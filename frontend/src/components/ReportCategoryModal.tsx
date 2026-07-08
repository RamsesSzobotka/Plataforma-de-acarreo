import { useState } from 'react'

export interface ReportCategory {
  value: string
  label: string
  description?: string
}

interface ReportCategoryModalProps {
  isOpen: boolean
  title: string
  categories: ReportCategory[]
  onSelect: (category: string) => void
  onClose: () => void
}

export function ReportCategoryModal({
  isOpen,
  title,
  categories,
  onSelect,
  onClose,
}: ReportCategoryModalProps) {
  const [selected, setSelected] = useState<string | null>(null)

  if (!isOpen) return null

  const handleContinue = () => {
    if (selected) {
      onSelect(selected)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          background: '#0F172A',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          animation: 'modalSlide var(--duration-normal) var(--ease-out)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '1.25rem',
                color: '#F97316',
              }}
            >
              flag
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                margin: 0,
                color: '#FFFFFF',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 'var(--radius)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94A3B8',
              transition: 'all var(--duration-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.color = '#FFFFFF'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.color = '#94A3B8'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>
              close
            </span>
          </button>
        </div>

        {/* Categories */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => setSelected(category.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: selected === category.value ? '#0D9488' : 'rgba(255, 255, 255, 0.05)',
                border: '2px solid',
                borderColor: selected === category.value ? '#0D9488' : 'transparent',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--duration-fast)',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (selected !== category.value) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (selected !== category.value) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: selected === category.value ? '#FFFFFF' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all var(--duration-fast)',
                }}
              >
                {selected === category.value && (
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 'var(--font-medium)',
                    color: '#FFFFFF',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {category.label}
                </div>
                {category.description && (
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: '#94A3B8',
                      marginTop: '2px',
                    }}
                  >
                    {category.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-6) var(--space-5)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: 'var(--space-3) var(--space-4)',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: 'var(--radius)',
              color: '#94A3B8',
              fontWeight: 'var(--font-medium)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              transition: 'all var(--duration-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.color = '#FFFFFF'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#94A3B8'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleContinue}
            disabled={!selected}
            style={{
              flex: 1,
              padding: 'var(--space-3) var(--space-4)',
              background: selected ? '#0D9488' : 'rgba(13, 148, 136, 0.3)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: '#FFFFFF',
              fontWeight: 'var(--font-semibold)',
              fontSize: 'var(--text-sm)',
              cursor: selected ? 'pointer' : 'not-allowed',
              transition: 'all var(--duration-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            Siguiente
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
              arrow_forward
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalSlide {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}