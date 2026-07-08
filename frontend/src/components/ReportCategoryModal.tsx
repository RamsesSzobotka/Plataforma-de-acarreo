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
        inset: 0,
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
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '1.25rem',
                color: 'var(--error)',
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
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: 'var(--radius)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all var(--duration-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-3)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)'
              e.currentTarget.style.color = 'var(--text-secondary)'
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
                background: selected === category.value ? 'var(--primary-subtle)' : 'var(--surface-2)',
                border: '2px solid',
                borderColor: selected === category.value ? 'var(--primary)' : 'transparent',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--duration-fast)',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (selected !== category.value) {
                  e.currentTarget.style.background = 'var(--surface-3)'
                }
              }}
              onMouseLeave={(e) => {
                if (selected !== category.value) {
                  e.currentTarget.style.background = 'var(--surface-2)'
                }
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: selected === category.value ? 'var(--primary)' : 'var(--text-muted)',
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
                      background: 'var(--primary)',
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 'var(--font-medium)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {category.label}
                </div>
                {category.description && (
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
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
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{
              flex: 1,
              color: 'var(--text-secondary)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="btn btn-primary"
            style={{
              flex: 1,
              opacity: selected ? 1 : 0.5,
              cursor: selected ? 'pointer' : 'not-allowed',
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
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}