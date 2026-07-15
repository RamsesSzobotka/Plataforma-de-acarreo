import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { showToast } from '../services/toast'
import { emailPreferencesAPI } from '../services/api'

interface EmailPreferences {
  onAccepted: boolean
  onInProgress: boolean
  onCompleted: boolean
  onCancelled: boolean
}

const TOGGLES: Array<{ key: keyof EmailPreferences; titleKey: string; subKey: string }> = [
  { key: 'onAccepted', titleKey: 'emailSettings.onAccepted', subKey: 'emailSettings.onAcceptedDesc' },
  { key: 'onInProgress', titleKey: 'emailSettings.onInProgress', subKey: 'emailSettings.onInProgressDesc' },
  { key: 'onCompleted', titleKey: 'emailSettings.onCompleted', subKey: 'emailSettings.onCompletedDesc' },
  { key: 'onCancelled', titleKey: 'emailSettings.onCancelled', subKey: 'emailSettings.onCancelledDesc' },
]

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 0',
}

export default function EmailNotificationSettings() {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const [prefs, setPrefs] = useState<EmailPreferences>({
    onAccepted: true,
    onInProgress: true,
    onCompleted: true,
    onCancelled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const token = await getToken()
        const data = await emailPreferencesAPI.get(token ?? undefined)
        if (!cancelled) setPrefs(data.emailPreferences)
      } catch {
        if (!cancelled) setError(t('emailSettings.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [getToken, t])

  const toggle = (key: keyof EmailPreferences) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const token = await getToken()
      await emailPreferencesAPI.update(prefs, token ?? undefined)
      showToast(t('emailSettings.savedSuccess'), 'success')
    } catch {
      showToast(t('emailSettings.saveError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>{t('emailSettings.loading')}</div>
      </div>
    )
  }

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
        {t('emailSettings.title')}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        {t('emailSettings.subtitle')}
      </p>

      {error && (
        <p style={{
          color: 'var(--error)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.9rem',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>error</span>
          {error}
        </p>
      )}

      <div
        style={{
          padding: '1.5rem',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--bg-primary)',
          marginBottom: '1.5rem',
        }}
      >
        {TOGGLES.map((item, i) => (
          <div
            key={item.key}
            style={{
              ...rowStyle,
              borderBottom: i < TOGGLES.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {t(item.titleKey)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t(item.subKey)}
              </div>
            </div>
            <div
              role="switch"
              aria-checked={prefs[item.key]}
              aria-label={t(item.titleKey)}
              tabIndex={0}
              onClick={() => toggle(item.key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(item.key) } }}
              style={{
                position: 'relative',
                width: '48px',
                height: '26px',
                background: prefs[item.key] ? 'var(--primary)' : 'var(--border)',
                borderRadius: '13px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
                marginLeft: '1rem',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: prefs[item.key] ? '25px' : '3px',
                  width: '20px',
                  height: '20px',
                  background: 'white',
                  borderRadius: '50%',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: 'var(--radius-sm)',
          cursor: saving ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: '1rem',
          opacity: saving ? 0.7 : 1,
          transition: 'all 0.2s',
        }}
      >
        {saving ? t('emailSettings.saving') : t('emailSettings.saveBtn')}
      </button>
    </div>
  )
}
