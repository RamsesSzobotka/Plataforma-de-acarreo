import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { hideLoading, showLoading } from '../services/alerts'

const API_URL = import.meta.env.VITE_API_URL || ''

// ── Types ───────────────────────────────────────────────────────────────────

interface McpTokenStatus {
  hasToken: boolean
  createdAt: string | null
  lastUsedAt: string | null
}

type McpState = 'loading' | 'no_token' | 'has_token'

interface Tool {
  name: string
  description: string
}

// ── Tool catalogs by role ────────────────────────────────────────────────────

const CLIENT_TOOLS: Tool[] = [
  { name: 'list_my_rides', description: 'Listar mis acarreos como cliente o conductor. Filtra por estado, página y límite.' },
  { name: 'create_ride', description: 'Crear un nuevo pedido de acarreo. Requiere mínimo 1 imagen.' },
  { name: 'get_ride_details', description: 'Obtener detalles completos de un acarreo por su ID.' },
  { name: 'view_offers', description: 'Ver ofertas recibidas para un acarreo.' },
  { name: 'accept_offer', description: 'Aceptar una oferta de un conductor para un acarreo.' },
  { name: 'confirm_delivery', description: 'Confirmar la entrega de un acarreo y cobrar al cliente.' },
  { name: 'cancel_ride', description: 'Cancelar un acarreo en estado requested.' },
  { name: 'rate_service', description: 'Calificar el servicio de un acarreo completado (1-5 estrellas).' },
  { name: 'get_public_driver_profile', description: 'Obtener el perfil público de un conductor por su ID.' },
]

const DRIVER_TOOLS: Tool[] = [
  { name: 'list_available_rides', description: 'Listar acarreos disponibles para un conductor.' },
  { name: 'propose_price', description: 'Proponer un precio para un acarreo.' },
  { name: 'send_message', description: 'Enviar un mensaje en un acarreo.' },
  { name: 'start_trip', description: 'Iniciar un viaje. Solo conductores verificados.' },
  { name: 'upload_delivery_photo', description: 'Subir una foto de la entrega.' },
  { name: 'get_payment_history', description: 'Ver historial de pagos recibidos.' },
  { name: 'get_driver_profile', description: 'Obtener el perfil del conductor autenticado.' },
]

// ── Component ───────────────────────────────────────────────────────────────

function SettingsMcp() {
  const { getToken } = useAuth()
  const { user } = useUser()

  const [state, setState] = useState<McpState>('loading')
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null)
  const [rawToken, setRawToken] = useState<string | null>(null) // Only shown once
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect role from Clerk publicMetadata
  const role = (user?.publicMetadata?.role as string | undefined) ?? 'client'
  const tools: Tool[] = role === 'driver' ? DRIVER_TOOLS : CLIENT_TOOLS

  // Active environment for snippet
  const [env, setEnv] = useState<'localhost' | 'production'>('localhost')
  const baseUrl = env === 'localhost' ? 'http://localhost:3000' : 'https://carglyn-backend.onrender.com'

  // ── Fetch token status ────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      setError(null)
      const jwt = await getToken()
      const res = await fetch(`${API_URL}/api/auth/mcp-token/status`, {
        headers: { Authorization: `Bearer ${jwt}` }
      })
      if (!res.ok) throw new Error('Error al obtener estado del token')
      const body = await res.json()
      const data: McpTokenStatus = body.data
      setCreatedAt(data.createdAt)
      setLastUsedAt(data.lastUsedAt)
      setState(data.hasToken ? 'has_token' : 'no_token')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setState('no_token')
    }
  }, [getToken])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (state === 'loading') {
      showLoading('Cargando configuración MCP...')
    } else {
      hideLoading()
    }
    return () => hideLoading()
  }, [state])

  // ── Generate token ─────────────────────────────────────────────────────────

  async function handleGenerate() {
    try {
      setGenerating(true)
      setError(null)
      const jwt = await getToken()
      const res = await fetch(`${API_URL}/api/auth/mcp-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al generar token' }))
        throw new Error(err.error || 'Error al generar token')
      }
      const body = await res.json()
      const token = body.data?.token
      if (!token) throw new Error('El servidor no devolvió un token válido')
      // Store raw token in memory — will be cleared on component unmount or revoke
      setRawToken(token)
      setCreatedAt(body.data?.createdAt || null)
      setLastUsedAt(null)
      setState('has_token')
      setConfirmGenerate(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar token')
    } finally {
      setGenerating(false)
    }
  }

  // ── Revoke token ───────────────────────────────────────────────────────────

  async function handleRevoke() {
    try {
      setRevoking(true)
      setError(null)
      const jwt = await getToken()
      const res = await fetch(`${API_URL}/api/auth/mcp-token`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` }
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al revocar token' }))
        throw new Error(err.error || 'Error al revocar token')
      }
      setRawToken(null)
      setCreatedAt(null)
      setLastUsedAt(null)
      setState('no_token')
      setConfirmRevoke(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al revocar token')
    } finally {
      setRevoking(false)
    }
  }

  // ── Clipboard ──────────────────────────────────────────────────────────────

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Config snippet ─────────────────────────────────────────────────────────

  function buildOpenCodeConfig(tokenValue: string): string {
    return JSON.stringify({
      mcpServers: {
        carglyn: {
          enabled: true,
          type: 'remote',
          transport: 'streamable-http',
          url: `${baseUrl}/api/mcp`,
          headers: {
            MCP_API_KEY: tokenValue
          }
        }
      }
    }, null, 2)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state === 'loading') return null

  return (
    <div>
      {/* Back link */}
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontSize: '0.875rem'
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>arrow_back</span>
        Volver al inicio
      </Link>

      {/* Header */}
      <h1 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">api</span>
        Conexión MCP
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
        Integra la plataforma con herramientas externas como OpenCode usando el protocolo MCP.
      </p>

      {/* Error alert */}
      {error && (
        <div style={{
          background: 'var(--error)',
          color: '#fff',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius)',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>error</span>
          {error}
        </div>
      )}

      {/* ── Section 1: Token Status ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">
            <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginRight: '0.5rem' }}>key</span>
            Token de Acceso
          </span>
          {state === 'has_token' ? (
            <span className="badge badge-success">Activo</span>
          ) : (
            <span className="badge badge-neutral">Sin Token</span>
          )}
        </div>
        <div className="card-body">
          {state === 'has_token' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Raw token — shown ONLY once right after generation */}
              {rawToken ? (
                <div style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem'
                }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    ⚠️ Este token se muestra solo una vez. Guárdalo en un lugar seguro.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input font-mono"
                      value={rawToken}
                      readOnly
                      style={{ fontSize: '0.75rem', flex: 1 }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(rawToken)}
                    >
                      <span className="material-symbols-rounded">content_copy</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Token generado. No se vuelve a mostrar por seguridad.
                </p>
              )}

              {/* Dates */}
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {createdAt && (
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>Creado: </span>
                    {new Date(createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                )}
                {lastUsedAt && (
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>Último uso: </span>
                    {new Date(lastUsedAt).toLocaleDateString('es-ES', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => setConfirmGenerate(true)}>
                  <span className="material-symbols-rounded">refresh</span>
                  Regenerar Token
                </button>
                <button className="btn btn-danger-outline" onClick={() => setConfirmRevoke(true)}>
                  <span className="material-symbols-rounded">delete_forever</span>
                  Revocar Token
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                No tienes un token de acceso. Genera uno para conectar herramientas MCP.
              </p>
              <button className="btn btn-primary" onClick={() => setConfirmGenerate(true)}>
                <span className="material-symbols-rounded">add</span>
                Generar Token
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Available Tools ───────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">
            <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginRight: '0.5rem' }}>build</span>
            Herramientas Disponibles
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {role === 'driver' ? 'Rol: Conductor' : 'Rol: Cliente'}
          </span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Herramientas MCP disponibles para tu rol. Configúralas en tu cliente MCP.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tools.map(tool => (
              <div key={tool.name} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem'
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>terminal</span>
                <div>
                  <code style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{tool.name}</code>
                  <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8125rem' }}>{tool.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3: Configuration ────────────────────────────────────── */}
      {state === 'has_token' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">
              <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginRight: '0.5rem' }}>code</span>
              Configuración OpenCode
            </span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Agrega esto en tu archivo de configuración de OpenCode (<code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>opencode.json</code>):
            </p>

            {/* Env toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                className={`tab ${env === 'localhost' ? 'active' : ''}`}
                onClick={() => setEnv('localhost')}
              >
                Localhost
              </button>
              <button
                className={`tab ${env === 'production' ? 'active' : ''}`}
                onClick={() => setEnv('production')}
              >
                Producción
              </button>
            </div>

            {/* Snippet */}
            <div style={{ position: 'relative' }}>
              <pre
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  overflow: 'auto',
                  fontSize: '0.75rem',
                  lineHeight: '1.6',
                  maxHeight: '400px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <code>{buildOpenCodeConfig('TU_TOKEN_AQUI')}</code>
              </pre>
              <button
                className={`btn btn-sm ${copied ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => copyToClipboard(buildOpenCodeConfig('TU_TOKEN_AQUI'))}
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
              >
                <span className="material-symbols-rounded">{copied ? 'check' : 'content_copy'}</span>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 4: Security note ──────────────────────────────────────── */}
      {state === 'has_token' && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)'
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', color: 'var(--warning)', flexShrink: 0 }}>info</span>
          <p style={{ margin: 0 }}>
            <strong>Seguridad:</strong> Después de revocar el token, cierra sesión en todos los clientes MCP
            que lo estén usando. El token es personal e intransferible.
          </p>
        </div>
      )}

      {/* ── Confirm Generate Modal ─────────────────────────────────────────── */}
      {confirmGenerate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 'var(--z-modal)', padding: '1rem'
        }}>
          <div className="card animate-scale-in" style={{ maxWidth: '400px', width: '100%' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>¿Generar token?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              {state === 'has_token'
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

      {/* ── Confirm Revoke Modal ──────────────────────────────────────────── */}
      {confirmRevoke && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 'var(--z-modal)', padding: '1rem'
        }}>
          <div className="card animate-scale-in" style={{ maxWidth: '400px', width: '100%' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>¿Revocar token?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Todas las conexiones que usen este token dejarán de funcionar inmediatamente.
              <strong> Esta acción no se puede deshacer.</strong>
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
