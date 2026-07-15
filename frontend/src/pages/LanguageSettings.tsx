import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const languages = [
  { code: 'es', codeLabel: 'ES', name: 'Español', desc: 'Idioma predeterminado de la plataforma' },
  { code: 'en', codeLabel: 'EN', name: 'English', desc: 'Switch to English interface' },
]

export default function LanguageSettings() {
  const { t, i18n } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'es').split('-')[0]

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Link
        to="/settings"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          marginBottom: '1.5rem',
        }}
      >
        <span className="material-symbols-rounded">arrow_back</span>
        {t('common.back')}
      </Link>

      <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
        {t('settings.language', 'Idioma')}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        {t('settings.languageDesc', 'Selecciona el idioma de la plataforma')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {languages.map(lang => {
          const isActive = lang.code === current
          return (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '1.25rem',
                borderRadius: 'var(--radius)',
                border: `1px solid ${isActive ? 'var(--primary, #0D9488)' : 'var(--border, #E2E8F0)'}`,
                background: isActive ? 'var(--bg-primary)' : 'var(--bg-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                width: '100%',
              }}
            >
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '16px',
                background: isActive ? 'var(--primary, #0D9488)' : 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading, sans-serif)',
                  lineHeight: 1,
                  color: isActive ? '#fff' : 'var(--text-primary)',
                  letterSpacing: '0.05em',
                }}>
                  {lang.codeLabel}
                </span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: '1.125rem',
                  color: isActive ? 'var(--primary, #0D9488)' : 'var(--text-primary)',
                  marginBottom: '0.15rem',
                }}>
                  {lang.name}
                  {isActive && (
                    <span style={{
                      display: 'inline-block',
                      marginLeft: '0.5rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: 'var(--primary, #0D9488)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      verticalAlign: 'middle',
                    }}>
                      {t('common.active', 'Activo')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {lang.desc}
                </div>
              </div>

              {isActive && (
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>
                  check_circle
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
