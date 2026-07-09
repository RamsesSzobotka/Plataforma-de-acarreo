import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { hideLoading, showLoading, showConfirm } from '../services/alerts'

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
  descriptionKey: string
}

// ── Component ───────────────────────────────────────────────────────────────

function SettingsMcp() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { t } = useTranslation()

  const [state, setState] = useState<McpState>('loading')
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null)
  const [rawToken, setRawToken] = useState<string | null>(null) // Only shown once
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect role from Clerk publicMetadata
  const role = (user?.publicMetadata?.role as string | undefined) ?? 'client'
  const tools: Tool[] = role === 'driver'
    ? [
        { name: 'list_available_rides', descriptionKey: 'mcp.tools.list_available_rides' },
        { name: 'propose_price', descriptionKey: 'mcp.tools.propose_price' },
        { name: 'send_message', descriptionKey: 'mcp.tools.send_message' },
        { name: 'start_trip', descriptionKey: 'mcp.tools.start_trip' },
        { name: 'upload_delivery_photo', descriptionKey: 'mcp.tools.upload_delivery_photo' },
        { name: 'get_payment_history', descriptionKey: 'mcp.tools.get_payment_history' },
        { name: 'get_driver_profile', descriptionKey: 'mcp.tools.get_driver_profile' },
      ]
    : [
        { name: 'list_my_rides', descriptionKey: 'mcp.tools.list_my_rides' },
        { name: 'create_ride', descriptionKey: 'mcp.tools.create_ride' },
        { name: 'get_ride_details', descriptionKey: 'mcp.tools.get_ride_details' },
        { name: 'view_offers', descriptionKey: 'mcp.tools.view_offers' },
        { name: 'accept_offer', descriptionKey: 'mcp.tools.accept_offer' },
        { name: 'confirm_delivery', descriptionKey: 'mcp.tools.confirm_delivery' },
        { name: 'cancel_ride', descriptionKey: 'mcp.tools.cancel_ride' },
        { name: 'rate_service', descriptionKey: 'mcp.tools.rate_service' },
        { name: 'get_public_driver_profile', descriptionKey: 'mcp.tools.get_public_driver_profile' },
      ]

  // Active environment for snippet
  const [env, setEnv] = useState<'localhost' | 'production'>('localhost')
  const [agentTab, setAgentTab] = useState<'opencode' | 'github' | 'claude' | 'codex'>('opencode')
  const baseUrl = env === 'localhost' ? 'http://localhost:3000' : 'https://carglyn-backend.onrender.com'

  // ── Fetch token status ────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      setError(null)
      const jwt = await getToken()
      const res = await fetch(`${API_URL}/api/auth/mcp-token/status`, {
        headers: { Authorization: `Bearer ${jwt}` }
      })
      if (!res.ok) throw new Error(t('mcp.errors.status'))
      const body = await res.json()
      const data: McpTokenStatus = body.data
      setCreatedAt(data.createdAt)
      setLastUsedAt(data.lastUsedAt)
      setState(data.hasToken ? 'has_token' : 'no_token')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setState('no_token')
    }
  }, [getToken])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (state === 'loading') {
      showLoading(t('mcp.loading'))
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
        const err = await res.json().catch(() => ({ error: t('mcp.errors.generate') }))
        throw new Error(err.error || t('mcp.errors.generate'))
      }
      const body = await res.json()
      const token = body.data?.token
      if (!token) throw new Error(t('mcp.errors.invalidToken'))
      // Store raw token in memory — will be cleared on component unmount or revoke
      setRawToken(token)
      setCreatedAt(body.data?.createdAt || null)
      setLastUsedAt(null)
      setState('has_token')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mcp.errors.generate'))
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
        const err = await res.json().catch(() => ({ error: t('mcp.errors.revoke') }))
        throw new Error(err.error || t('mcp.errors.revoke'))
      }
      setRawToken(null)
      setCreatedAt(null)
      setLastUsedAt(null)
      setState('no_token')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mcp.errors.revoke'))
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

  function buildSnippet(): string {
    const entry = {
      carglyn: {
        enabled: true,
        type: 'remote',
        transport: 'streamable-http',
        url: `${baseUrl}/api/mcp`,
        headers: {
          MCP_API_KEY: 'TU_TOKEN_AQUI'
        }
      }
    }
    return JSON.stringify(entry, null, 2)
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
        {t('mcp.backHome')}
      </Link>

      {/* Header */}
      <h1 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">api</span>
        {t('mcp.title')}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
        {t('mcp.subtitle')}
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
            {t('mcp.token')}
          </span>
          {state === 'has_token' ? (
            <span className="badge badge-success">{t('mcp.active')}</span>
          ) : (
            <span className="badge badge-neutral">{t('mcp.noTokenShort')}</span>
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
                    {t('mcp.tokenWarning')}
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
                  {t('mcp.tokenGeneratedOnce')}
                </p>
              )}

              {/* Dates */}
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {createdAt && (
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>{t('mcp.createdAt')}: </span>
                    {new Date(createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                )}
                {lastUsedAt && (
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>{t('mcp.lastUsedAt')}: </span>
                    {new Date(lastUsedAt).toLocaleDateString('es-ES', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={async () => {
                  const confirmed = await showConfirm({
                    icon: 'warning',
                    title: t('mcp.regenerateTokenTitle'),
                    text: t('mcp.generateTokenHasExisting'),
                    confirmText: t('common.confirm'),
                    cancelText: t('common.cancel'),
                  })
                  if (confirmed) handleGenerate()
                }}>
                  <span className="material-symbols-rounded">refresh</span>
                  {t('mcp.regenerate')}
                </button>
                <button className="btn btn-danger-outline" onClick={async () => {
                  const confirmed = await showConfirm({
                    icon: 'warning',
                    title: t('mcp.revokeTokenTitle'),
                    text: t('mcp.revokeTokenText') + ' ' + t('mcp.revokeTokenUndo'),
                    confirmText: t('mcp.revoke'),
                    cancelText: t('common.cancel'),
                  })
                  if (confirmed) handleRevoke()
                }}>
                  <span className="material-symbols-rounded">delete_forever</span>
                  {t('mcp.revoke')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {t('mcp.noToken')}
              </p>
<button className="btn btn-primary" onClick={async () => {
                const confirmed = await showConfirm({
                  icon: 'info',
                  title: t('mcp.generateTokenTitle'),
                  text: t('mcp.generateTokenNew'),
                  confirmText: t('common.confirm'),
                  cancelText: t('common.cancel'),
                })
                if (confirmed) handleGenerate()
              }}>
                  <span className="material-symbols-rounded">add</span>
                  {t('mcp.generateToken')}
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
            {t('mcp.toolsTitle')}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {role === 'driver' ? t('mcp.roleDriver') : t('mcp.roleClient')}
          </span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {t('mcp.toolsSubtitle')}
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
                  <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.8125rem' }}>{t(tool.descriptionKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3: MCP Client Configuration ──────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">
              <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginRight: '0.5rem' }}>code</span>
              {t('mcp.configTitle')}
            </span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {t('mcp.configSubtitle')}
            </p>

            {/* Environment Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                className={`tab ${env === 'localhost' ? 'active' : ''}`}
                onClick={() => setEnv('localhost')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>laptop</span>
                Localhost
              </button>
              <button
                className={`tab ${env === 'production' ? 'active' : ''}`}
                onClick={() => setEnv('production')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>cloud</span>
                Producción
              </button>
            </div>

            {/* Tool Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button
                className={`tab ${agentTab === 'opencode' ? 'active' : ''}`}
                onClick={() => setAgentTab('opencode')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>terminal</span>
                {t('mcp.tab.opencode')}
              </button>
              <button
                className={`tab ${agentTab === 'github' ? 'active' : ''}`}
                onClick={() => setAgentTab('github')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>code</span>
                {t('mcp.tab.github')}
              </button>
              <button
                className={`tab ${agentTab === 'claude' ? 'active' : ''}`}
                onClick={() => setAgentTab('claude')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>psychology</span>
                {t('mcp.tab.claude')}
              </button>
              <button
                className={`tab ${agentTab === 'codex' ? 'active' : ''}`}
                onClick={() => setAgentTab('codex')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>smart_toy</span>
                {t('mcp.tab.codex')}
              </button>
            </div>

            {/* Tab Content */}
            {agentTab === 'opencode' ? (
              <>
                {/* Instructions for OpenCode */}
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>folder</span>
                  <span>
                    {t('mcp.configFile', { path: '~/.config/opencode/opencode.json' })}
                    <br />
                    {t('mcp.configMcpServers')}
                  </span>
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
                    <code>{buildSnippet()}</code>
                  </pre>
                  <button
                    className={`btn btn-sm ${copied ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => copyToClipboard(buildSnippet())}
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
                  >
                    <span className="material-symbols-rounded">{copied ? 'check' : 'content_copy'}</span>
                    {copied ? t('mcp.copySuccess') : t('mcp.copy')}
                  </button>
                </div>
              </>
            ) : agentTab === 'claude' ? (
              <>
                {/* Instructions for Claude */}
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>info</span>
                  <span>{t('mcp.claude.instructions')}</span>
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <p>{t('mcp.claude.step1')}</p>
                  <p>{t('mcp.claude.step2')}</p>
                  <p>{t('mcp.claude.step3')}</p>
                </div>

                {/* URL box with copy */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  marginTop: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    {t('mcp.claude.urlLabel')}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input font-mono"
                      value={`${baseUrl}/mcp`}
                      readOnly
                      style={{ fontSize: '0.8125rem', flex: 1 }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(`${baseUrl}/mcp`)}
                    >
                      <span className="material-symbols-rounded">{copied ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                </div>

                {/* No API key needed */}
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {t('mcp.claude.step4')}
                </p>
              </>
            ) : agentTab === 'codex' ? (
              <>
                {/* Instructions for Codex */}
                <div style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>info</span>
                  <span>{t('mcp.codex.instructions')}</span>
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <p>{t('mcp.codex.step1')}</p>
                  <p>{t('mcp.codex.step2')}</p>
                  <p>{t('mcp.codex.step3')}</p>
                  <p>{t('mcp.codex.step4')}</p>
                  <p>{t('mcp.codex.step5')}</p>
                </div>

                {/* URL box with copy */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  marginTop: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    {t('mcp.codex.urlLabel')}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input font-mono"
                      value={`${baseUrl}/mcp`}
                      readOnly
                      style={{ fontSize: '0.8125rem', flex: 1 }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(`${baseUrl}/mcp`)}
                    >
                      <span className="material-symbols-rounded">{copied ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Placeholder for GitHub (not yet implemented) */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1rem',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.5 }}>
                  code
                </span>
                <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('mcp.comingSoon')}
                </p>
                <p style={{ fontSize: '0.8125rem' }}>
                  {t('mcp.comingSoonText', { tool: t('mcp.tab.github') })}
                </p>
              </div>
            )}
          </div>
        </div>

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
            <strong>{t('mcp.securityLabel')}:</strong> {t('mcp.securityText')}
          </p>
        </div>
      )}

      
    </div>
  )
}

export default SettingsMcp
