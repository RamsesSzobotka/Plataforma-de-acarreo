import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface SettingsItem {
  icon: string
  titleKey: string
  descKey: string
  to: string
}

const SETTINGS_ITEMS: SettingsItem[] = [
  { icon: 'api', titleKey: 'settings.mcp', descKey: 'settings.mcpDesc', to: '/settings/mcp' },
  { icon: 'privacy_tip', titleKey: 'settings.privacy', descKey: 'settings.privacyDesc', to: '/settings/gdpr' },
  { icon: 'mail', titleKey: 'settings.email', descKey: 'settings.emailDesc', to: '/settings/email-notifications' },
  { icon: 'credit_card', titleKey: 'settings.payment', descKey: 'settings.paymentDesc', to: '/add-payment-method' },
]

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1.25rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  textDecoration: 'none',
  transition: 'all 0.2s ease',
  cursor: 'pointer',
}

export default function Settings() {
  const { t } = useTranslation()

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Link
        to="/my-rides"
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
        {t('settings.title')}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        {t('settings.subtitle')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {SETTINGS_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(13, 148, 136, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>
                {item.icon}
              </span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                {t(item.titleKey)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {t(item.descKey)}
              </div>
            </div>

            <span className="material-symbols-rounded" style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>
              chevron_right
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
