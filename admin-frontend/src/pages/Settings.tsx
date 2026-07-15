import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function Settings() {
  const [debugMode, setDebugMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    api.getSettings()
      .then((data: any) => {
        setDebugMode(data.debugMode)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  async function handleToggle() {
    const newValue = !debugMode
    setSaving(true)
    setMessage(null)
    try {
      const result = await api.updateSettings({ debugMode: newValue })
      setDebugMode(result.debugMode)
      setMessage({ type: 'success', text: result.message || `Modo debug ${result.debugMode ? 'activado' : 'desactivado'}` })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al actualizar' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Ajustes</h1>
        </div>
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Ajustes</h1>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          <span className="material-symbols-rounded">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {message.text}
        </div>
      )}

      <div className="card" style={{ maxWidth: '600px', marginTop: '1rem' }}>
        <div className="card-header">
          <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>bug_report</span>
          <h3>Modo Debug</h3>
        </div>
        <div className="card-body">
          <div className="setting-row">
            <div className="setting-info">
              <p className="setting-label">Registro detallado (logs)</p>
              <p className="setting-description">
                Al activarlo, se habilitan todos los logs del backend (console.log, console.debug).
                Desactivado solo muestra errores y advertencias.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={handleToggle}
                disabled={saving}
              />
              <span className="toggle-slider">
                <span className="material-symbols-rounded toggle-icon">
                  {debugMode ? 'visibility' : 'visibility_off'}
                </span>
              </span>
            </label>
          </div>
          <div className="setting-status">
            <span className={`status-badge ${debugMode ? 'status-active' : 'status-inactive'}`}>
              <span className="status-dot" />
              {debugMode ? 'Activado' : 'Desactivado'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Efecto inmediato — no requiere reinicio
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
