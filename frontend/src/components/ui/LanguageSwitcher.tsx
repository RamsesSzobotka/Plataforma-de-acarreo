import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'es').split('-')[0]

  return (
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          style={{
            padding: '0.35rem 0.65rem',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 'var(--radius-sm, 8px)',
            background: lang.code === current ? 'var(--primary, #0D9488)' : 'transparent',
            color: lang.code === current ? '#fff' : 'var(--text-secondary, #334155)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body, sans-serif)',
            fontSize: '0.8rem',
            fontWeight: lang.code === current ? 700 : 600,
            letterSpacing: '0.05em',
            transition: 'all 0.15s',
          }}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
