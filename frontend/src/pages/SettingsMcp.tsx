import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { hideLoading, showLoading } from '../services/alerts'

const API_URL = import.meta.env.VITE_API_URL || ''

interface McpTokenStatus {
  hasToken: boolean
  createdAt: string | null
  lastUsedAt: string | null
}

function SettingsMcp() {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'opencode' | 'claude'>('opencode')
  const [activeEnv, setActiveEnv] = useState<'localhost' | 'production'>('localhost')
  const [token, setToken] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showToken, setShowToken] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const jwt = await getToken()
      const res = await fetch(`${API_URL}/api/auth/mcp-token/status`, {
        headers: { Authorization: `Bearer ${jwt}` }
      })
      if (res.ok) {
        const body = await res.json()
        const data: McpTokenStatus = body.data
        setHasToken(data.hasToken)
        setCreatedAt(data.createdAt)
        setLastUsedAt(data.lastUsedAt)
      }
    } catch (err) {
      console.error('Error fetching MCP token status:', err)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (loading) {
      showLoading('Cargando configuración MCP...')
    } else {
      hideLoading()
    }
    return () => hideLoading()
  }, [loading])

  async function handleGenerate() {
    try {
      setGenerating(true)
      const jwt = await getToken()
      const res = await fetch(`${API_URL}/api/auth/mcp-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      })
      if (res.ok) {
        const body = await res.json()
        const token = body.data?.token
        if (!token) {
          console.error('Token no recibido en la respuesta:', body)
          alert('Error: el servidor no devolvió un token válido')
          return
        }
        setToken(token)
        sessionStorage.setItem('mcp_token', token)  // Persistir entre refreshes
        setHasToken(true)
        setCreatedAt(body.data?.createdAt || null)
        setLastUsedAt(null)
        setConfirmGenerate(false)
        setShowToken(true)
      } else {
        const err = await res.json().catch(() => ({ error: 'Error al generar token' }))
        alert(err.error || 'Error al generar token')
      }
    } catch (err) {
      console.error('Error generating MCP token:', err)
      alert('Error al generar token')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevoke() {
    try {
      setRevoking(true)
      const jwt = await getToken()
      const res = await fetch(`${API_URL}/api/auth/mcp-token`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` }
      })
      if (res.ok) {
        setToken(null)
        sessionStorage.removeItem('mcp_token')  // Limpiar al revocar
        setHasToken(false)
        setCreatedAt(null)
        setLastUsedAt(null)
        setShowToken(false)
        setConfirmRevoke(false)
      } else {
        const err = await res.json().catch(() => ({ error: 'Error al revocar token' }))
        alert(err.error || 'Error al revocar token')
      }
    } catch (err) {
      console.error('Error revoking MCP token:', err)
      alert('Error al revocar token')
    } finally {
      setRevoking(false)
    }
  }

  const baseUrl = activeEnv === 'localhost' ? 'http://localhost:3000' : 'https://api.carglyn.com'
  // El token real se guarda en sessionStorage para sobrevivir al refresh
  const stored = sessionStorage.getItem('mcp_token')
  const persistedToken = token ?? (stored && stored !== 'undefined' ? stored : null)
  const showPlaceholder = !persistedToken && hasToken
  const currentToken = persistedToken || ''
  const maskedToken = showPlaceholder ? '********'
    : currentToken ? currentToken.slice(0, 8) + '…' + currentToken.slice(-4)
    : 'TU_TOKEN_AQUI'
  const copyToken = currentToken || (showPlaceholder ? '********' : 'TU_TOKEN_AQUI')

  function buildConfig(tokenValue: string): string {
    if (activeTab === 'opencode') {
      return JSON.stringify({
        mcp: {
          carglyn: {
            enabled: true,
            type: 'remote',
            url: `${baseUrl}/api/mcp`,
            env: {
              MCP_API_KEY: tokenValue
            }
          }
        }
      }, null, 2)
    }

    if (activeEnv === 'localhost') {
      return JSON.stringify({
        mcpServers: {
          carglyn: {
            command: 'bun',
            args: ['run', '../mcp-server/src/index.ts'],
            env: {
              MCP_API_KEY: tokenValue,
              BACKEND_URL: 'http://localhost:3000'
            }
          }
        }
      }, null, 2)
    }

    return JSON.stringify({
      mcpServers: {
        carglyn: {
          url: `${baseUrl}/api/mcp`,
          headers: {
            MCP_API_KEY: tokenValue
          }
        }
      }
    }, null, 2)
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(buildConfig(copyToken))
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = buildConfig(copyToken)
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2000)
  }

  if (loading) return null

  return (
    <div>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
        <span className="material-symbols-rounded">arrow_back</span>
        Volver al Inicio
      </Link>

      <h1 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">api</span>
        Conexión MCP
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Administra tu token de conexión MCP para integrar la plataforma con herramientas externas como OpenCode y Claude Desktop.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">
            <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginRight: '0.5rem' }}>key</span>
            Token de Acceso
          </span>
          {hasToken ? (
            <span className="badge badge-success">Activo</span>
          ) : (
            <span className="badge badge-neutral">Sin Token</span>
          )}
        </div>
        <div className="card-body">
          {hasToken ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {showToken && token && (
                <div>
                  <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                    Token (copia ahora, no se mostrará de nuevo)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input font-mono"
                      value={token}
                      readOnly
                      style={{ fontSize: '0.75rem' }}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(token)}>
                      <span className="material-symbols-rounded">content_copy</span>
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {createdAt && (
                  <span>Creado: {new Date(createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                )}
                {lastUsedAt && (
                  <span>Último uso: {new Date(lastUsedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={() => setConfirmGenerate(true)}>
                  <span className="material-symbols-rounded">refresh</span>
                  Generar Nuevo Token
                </button>
                <button className="btn btn-danger" onClick={() => setConfirmRevoke(true)}>
                  <span className="material-symbols-rounded">delete_forever</span>
                  Revocar Token
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                No tienes un token de acceso configurado. Genera uno para conectar herramientas externas.
              </p>
              <button className="btn btn-primary" onClick={() => setConfirmGenerate(true)}>
                <span className="material-symbols-rounded">add</span>
                Generar Token
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginRight: '0.5rem' }}>code</span>
            Configuración
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <div className="tabs">
              <button className={`tab ${activeTab === 'opencode' ? 'active' : ''}`} onClick={() => setActiveTab('opencode')}>
                OpenCode
              </button>
              <button className={`tab ${activeTab === 'claude' ? 'active' : ''}`} onClick={() => setActiveTab('claude')}>
                Claude Desktop
              </button>
            </div>
            <div className="tabs">
              <button className={`tab ${activeEnv === 'localhost' ? 'active' : ''}`} onClick={() => setActiveEnv('localhost')}>
                Localhost
              </button>
              <button className={`tab ${activeEnv === 'production' ? 'active' : ''}`} onClick={() => setActiveEnv('production')}>
                Producción
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <pre
              className="font-mono"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1rem',
                overflow: 'auto',
                fontSize: '0.75rem',
                lineHeight: '1.5',
                maxHeight: '400px',
                color: 'var(--text-primary)'
              }}
            >
              <code>{buildConfig(maskedToken)}</code>
            </pre>
            <button
              className={`btn btn-sm ${copiedSnippet ? 'btn-primary' : 'btn-secondary'}`}
              onClick={copyToClipboard}
              style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
            >
              <span className="material-symbols-rounded">{copiedSnippet ? 'check' : 'content_copy'}</span>
              {copiedSnippet ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>

      {confirmGenerate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 'var(--z-modal)', padding: '1rem'
        }}>
          <div className="card animate-scale-in" style={{ maxWidth: '400px', width: '100%' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>¿Generar nuevo token?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              {hasToken
                ? 'Esto invalidará el token actual. Las conexiones existentes dejarán de funcionar.'
                : 'Se generará un nuevo token de acceso para conexiones MCP.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmGenerate(false)} disabled={generating}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRevoke && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 'var(--z-modal)', padding: '1rem'
        }}>
          <div className="card animate-scale-in" style={{ maxWidth: '400px', width: '100%' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>¿Revocar token?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Todas las conexiones que usen este token dejarán de funcionar inmediatamente. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmRevoke(false)} disabled={revoking}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleRevoke} disabled={revoking}>
                {revoking ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : null}
                Revocar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsMcp
