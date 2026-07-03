import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'es', name: 'Español', flag: '🇵🇦' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
]

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'es').toString().split('-')[0]
  const currentLang = languages.find(l => l.code === currentLanguage) || languages[0]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('nav.language')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: 'transparent',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          borderRadius: 'var(--radius-sm, 8px)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body, sans-serif)',
          fontSize: 'var(--text-sm, 0.875rem)',
          color: 'var(--text-secondary, #334155)',
          transition: 'all var(--duration-fast, 0.15s)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-1, #F1F5F9)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>{currentLang.flag}</span>
        <span>{currentLang.name}</span>
        <span 
          className="material-symbols-rounded" 
          style={{ 
            fontSize: '1rem', 
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.25rem',
            background: 'var(--surface-0, #FFFFFF)',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            borderRadius: 'var(--radius-sm, 8px)',
            boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1))',
            overflow: 'hidden',
            zIndex: 100,
            minWidth: '140px',
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: lang.code === currentLanguage 
                  ? 'var(--primary, #0D9488)' 
                  : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: 'var(--text-sm, 0.875rem)',
                color: lang.code === currentLanguage 
                  ? '#FFFFFF' 
                  : 'var(--text-primary, #0F172A)',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (lang.code !== i18n.language) {
                  e.currentTarget.style.background = 'var(--surface-1, #F1F5F9)'
                }
              }}
              onMouseLeave={(e) => {
                if (lang.code !== i18n.language) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}