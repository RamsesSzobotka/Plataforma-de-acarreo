import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import Swal from 'sweetalert2'
import { gdprAPI } from '../services/api'

export default function GdprSettings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { signOut } = useClerk()
  const [loading, setLoading] = useState({ export: false, delete: false })
  const [exported, setExported] = useState(false)

  const handleExport = async () => {
    setLoading(prev => ({ ...prev, export: true }))
    try {
      const token = await getToken()
      await gdprAPI.exportData(token ?? undefined)
      setExported(true)
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: t('common.error', 'Error'),
        text: t('gdpr.exportError', 'No se pudo exportar los datos'),
      })
    } finally {
      setLoading(prev => ({ ...prev, export: false }))
    }
  }

  const handleDelete = () => {
    Swal.fire({
      title: t('gdpr.confirmDeleteTitle', '¿Eliminar cuenta?'),
      text: t('gdpr.confirmDeleteText', 'Todos tus datos personales serán anonimizados. Esta acción no se puede deshacer.'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: t('gdpr.confirmDeleteBtn', 'Sí, eliminar mi cuenta'),
      cancelButtonText: t('common.cancel', 'Cancelar'),
    }).then(async (result) => {
      if (result.isConfirmed) {
        setLoading(prev => ({ ...prev, delete: true }))
        try {
          const token = await getToken()
          await gdprAPI.deleteAccount(token ?? undefined)
          await signOut()
          navigate('/')
        } catch (err) {
          Swal.fire({
            icon: 'error',
            title: t('common.error', 'Error'),
            text: t('gdpr.deleteError', 'No se pudo eliminar la cuenta'),
          })
        } finally {
          setLoading(prev => ({ ...prev, delete: false }))
        }
      }
    })
  }

  return (
    <div className="page-container" style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Link to="/settings" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
        <span className="material-symbols-rounded">arrow_back</span>
        {t('common.back', 'Volver')}
      </Link>

      <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
        {t('gdpr.title', 'Privacidad y Datos')}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        {t('gdpr.subtitle', 'Gestiona tus datos personales según el Reglamento General de Protección de Datos (GDPR)')}
      </p>

      {/* Export section */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span className="material-symbols-rounded">download</span>
          {t('gdpr.exportTitle', 'Descargar mis datos')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {t('gdpr.exportText', 'Recibe un archivo JSON con toda la información que tenemos sobre ti: perfil, acarreos, mensajes y calificaciones.')}
        </p>
        <button
          onClick={handleExport}
          disabled={loading.export}
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: 600,
            opacity: loading.export ? 0.7 : 1,
          }}
        >
          {loading.export ? t('gdpr.exporting', 'Exportando...') : t('gdpr.exportBtn', 'Descargar mis datos')}
        </button>
        {exported && (
          <p style={{ color: 'var(--success)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>check_circle</span>
            {t('gdpr.exportSuccess', 'Datos exportados correctamente')}
          </p>
        )}
      </div>

      {/* Delete section */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--error)', background: 'var(--bg-primary)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--error)' }}>
          <span className="material-symbols-rounded">delete_forever</span>
          {t('gdpr.deleteTitle', 'Eliminar mi cuenta')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {t('gdpr.deleteText', 'Solicita la anonimización de todos tus datos personales. Tus acarreos pasados se conservarán para registros comerciales, pero sin información personal.')}
        </p>
        <button
          onClick={handleDelete}
          disabled={loading.delete}
          style={{
            background: 'var(--error)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: 600,
            opacity: loading.delete ? 0.7 : 1,
          }}
        >
          {loading.delete ? t('gdpr.deleting', 'Eliminando...') : t('gdpr.deleteBtn', 'Eliminar mi cuenta')}
        </button>
      </div>
    </div>
  )
}
