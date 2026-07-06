import { Hono } from 'hono/tiny'
import { verifyToken } from '@clerk/clerk-sdk-node'
import { getOAuthClientByClientId } from '../models/oauthClient'
import { getOAuthCodeByCode, getOAuthTokenByTokenId, revokeOAuthToken, saveOAuthCode } from '../models/oauthToken'
import { exchangeAuthorizationCode, refreshAccessToken, registerOAuthClient, OAuthError, generateAuthCode, type DcrResponse } from '../services/oauth'
import { getMcpServerUrl } from '../services/jwt'
import { listTools, registerAllTools } from '../mcp/tools/index'

const oauthApp = new Hono()

// ── OAuth-specific rate limiting (in-memory, per-IP) ───────────────────────

interface OAuthRateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, OAuthRateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key)
  }
}, 5 * 60 * 1000)

function checkRateLimit(ip: string, maxRequests = 300, windowMs = 60000): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  let entry = rateLimitStore.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    rateLimitStore.set(ip, entry)
  }
  entry.count++
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true, remaining: maxRequests - entry.count }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getClientIp(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
}

function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=')
    if (name === '__session') return decodeURIComponent(rest.join('=').trim())
  }
  return null
}

function parseBasicAuth(header: string | undefined): { clientId: string; clientSecret: string } | null {
  if (!header || !header.startsWith('Basic ')) return null
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString()
    const colonIdx = decoded.indexOf(':')
    if (colonIdx === -1) return null
    return { clientId: decoded.slice(0, colonIdx), clientSecret: decoded.slice(colonIdx + 1) }
  } catch {
    return null
  }
}

// Map tool names to Material Symbols icons
function toolIcon(name: string): string {
  const iconMap: Record<string, string> = {
    list_my_rides: 'format_list_bulleted',
    create_ride: 'add_circle',
    get_ride_details: 'info',
    view_offers: 'request_quote',
    accept_offer: 'handshake',
    confirm_delivery: 'check_circle',
    cancel_ride: 'cancel',
    rate_service: 'star',
    get_public_driver_profile: 'person_search',
    list_available_rides: 'explore',
    propose_price: 'payments',
    send_message: 'chat',
    start_trip: 'play_circle',
    upload_delivery_photo: 'add_a_photo',
    get_payment_history: 'receipt_long',
    get_driver_profile: 'badge',
  }
  return iconMap[name] || 'build'
}

type ToolGroupKey = 'client' | 'driver' | 'shared'

function toolGroup(name: string): { key: ToolGroupKey; label: string; icon: string; note: string } {
  const groupMap: Record<string, { key: ToolGroupKey; label: string; icon: string; note: string }> = {
    list_my_rides: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'orders', note: 'Flujo principal del cliente.' },
    create_ride: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'add_circle', note: 'Flujo principal del cliente.' },
    get_ride_details: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'info', note: 'Flujo principal del cliente.' },
    view_offers: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'request_quote', note: 'Flujo principal del cliente.' },
    accept_offer: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'handshake', note: 'Flujo principal del cliente.' },
    confirm_delivery: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'check_circle', note: 'Flujo principal del cliente.' },
    cancel_ride: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'cancel', note: 'Flujo principal del cliente.' },
    rate_service: { key: 'client', label: 'Pedidos y confirmaciones', icon: 'star', note: 'Flujo principal del cliente.' },
    get_public_driver_profile: { key: 'shared', label: 'Comunicación y consulta', icon: 'person_search', note: 'Información pública y validación.' },
    send_message: { key: 'shared', label: 'Comunicación y consulta', icon: 'chat', note: 'Negociación en tiempo real.' },
    list_available_rides: { key: 'driver', label: 'Operación del conductor', icon: 'explore', note: 'Búsqueda y oferta.' },
    propose_price: { key: 'driver', label: 'Operación del conductor', icon: 'payments', note: 'Búsqueda y oferta.' },
    start_trip: { key: 'driver', label: 'Operación del conductor', icon: 'play_circle', note: 'Búsqueda y oferta.' },
    upload_delivery_photo: { key: 'driver', label: 'Operación del conductor', icon: 'add_a_photo', note: 'Búsqueda y oferta.' },
    get_payment_history: { key: 'driver', label: 'Operación del conductor', icon: 'receipt_long', note: 'Búsqueda y oferta.' },
    get_driver_profile: { key: 'driver', label: 'Operación del conductor', icon: 'badge', note: 'Búsqueda y oferta.' },
  }

  return groupMap[name] || { key: 'shared', label: 'Comunicación y consulta', icon: 'apps', note: 'Acceso general de la integración.' }
}

function toolAudience(name: string): string {
  if (name === 'get_public_driver_profile' || name === 'send_message' || name === 'list_my_rides') return 'Compartida'
  if (name.startsWith('list_available') || name.startsWith('propose_') || name.startsWith('start_') || name.startsWith('upload_') || name.startsWith('get_payment') || name === 'get_driver_profile') return 'Conductor'
  return 'Cliente'
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function rateLimited(c: any, maxRequests = 300): boolean {
  const ip = getClientIp(c)
  const result = checkRateLimit(ip, maxRequests)
  c.header('X-RateLimit-Limit', String(maxRequests))
  c.header('X-RateLimit-Remaining', String(result.remaining))
  if (result.retryAfter) c.header('Retry-After', String(result.retryAfter))
  if (!result.allowed) {
    c.res = jsonResponse({ error: 'too_many_requests', error_description: 'Rate limit exceeded. Try again later.', retryAfter: result.retryAfter }, 429)
    return false
  }
  return true
}

// ── Well-Known Endpoints ───────────────────────────────────────────────────

const baseUrl = () => getMcpServerUrl()

oauthApp.get('/.well-known/oauth-protected-resource', (c) => {
  const base = baseUrl()
  return c.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ['mcp:tools'],
    bearer_token_formats_supported: ['opaque', 'jwt'],
  })
})

oauthApp.get('/.well-known/oauth-authorization-server', (c) => {
  const base = baseUrl()
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: ['mcp:tools'],
    response_types_supported: ['code'],
    response_modes_supported: ['query', 'fragment'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    token_endpoint_auth_signing_alg_values_supported: ['HS256'],
    client_registration_types_supported: ['automatic'],
    client_registration_metadata_supported: ['redirect_uris', 'client_name', 'grant_types'],
  })
})

// ── Dynamic Client Registration ────────────────────────────────────────────

oauthApp.post('/oauth/register', async (c) => {
  if (!rateLimited(c)) return c.res

  try {
    const body = await c.req.json<{
      client_name?: string
      redirect_uris: string[]
      grant_types?: string[]
    }>()

    if (!body.redirect_uris?.length) {
      return jsonResponse({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, 400)
    }

    const result = await registerOAuthClient({
      clientName: body.client_name,
      redirectUris: body.redirect_uris,
      grantTypes: body.grant_types,
    })

    c.header('Cache-Control', 'no-store')
    c.header('Pragma', 'no-cache')
    return c.json(result, 201)
  } catch (err) {
    if (err instanceof OAuthError) {
      return new Response(JSON.stringify({ error: err.error, error_description: err.description }), {
        status: err.statusCode,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw err
  }
})

// ── Authorization Endpoint ─────────────────────────────────────────────────

function buildConsentHtml(params: {
  clientName: string
  userEmail: string
  scope: string
  actionUrl: string
  hiddenFields: string
  toolSectionsHtml: string
  logoUrl: string
  toolCount: number
  groupCount: number
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Autorizar conexión — Carglyn</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@600;700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0D9488;
      --primary-hover: #0F766E;
      --secondary: #F97316;
      --secondary-hover: #EA580C;
      --success: #22C55E;
      --warning: #F59E0B;
      --error: #EF4444;
      --bg-primary: #FFFFFF;
      --bg-secondary: #F8FAFC;
      --bg-tertiary: #F1F5F9;
      --text-primary: #0F172A;
      --text-secondary: #334155;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --border-strong: #CBD5E1;
      --radius: 12px;
      --radius-sm: 8px;
      --radius-lg: 20px;
      --shadow: 0 18px 40px -22px rgba(15,23,42,0.45);
      --shadow-soft: 0 10px 24px -18px rgba(15,23,42,0.35);
      --font-heading: 'Plus Jakarta Sans', sans-serif;
      --font-body: 'Inter', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-body);
      min-height: 100vh;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(circle at top left, rgba(13,148,136,0.16), transparent 32%),
        radial-gradient(circle at right 20%, rgba(249,115,22,0.12), transparent 28%),
        linear-gradient(180deg, #F8FAFC 0%, #EEF2F7 100%);
      color: var(--text-primary);
    }
    .card {
      position: relative;
      width: 100%;
      max-width: 980px;
      background: rgba(255,255,255,0.96);
      border: 1px solid rgba(226,232,240,0.8);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
      backdrop-filter: blur(12px);
    }
    .card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 8px;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
    }
    .card-inner { padding: 28px; }
    .card-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
    .brand { display: flex; align-items: center; gap: 0.9rem; }
    .card-header img.logo { height: 42px; width: auto; }
    .card-header .logo-mark {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(13,148,136,0.12);
      color: var(--primary);
    }
    .card-header .logo-text { font-family: var(--font-heading); font-weight: 700; font-size: 1.2rem; color: var(--primary); }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.8rem;
      border-radius: 999px;
      background: rgba(13,148,136,0.12);
      color: var(--primary);
      font: 600 0.78rem var(--font-mono);
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr); gap: 1rem; align-items: start; }
    .title { font-family: var(--font-heading); font-size: clamp(1.55rem, 2vw, 2.15rem); color: var(--text-primary); margin-bottom: 0.6rem; line-height: 1.1; }
    .subtitle { color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.98rem; line-height: 1.6; max-width: 58ch; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
    .summary-card {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.9rem;
      background: linear-gradient(180deg, #fff, #F8FAFC);
      box-shadow: var(--shadow-soft);
      min-height: 88px;
    }
    .summary-card .label { color: var(--text-muted); font-size: 0.76rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.45rem; }
    .summary-card .value { font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.2rem; }
    .summary-card .note { font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; }
    .user-info, .scope-panel {
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--bg-primary);
      box-shadow: var(--shadow-soft);
    }
    .user-info { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; margin-bottom: 0.75rem; }
    .user-info .icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
      background: rgba(13,148,136,0.12);
      font-size: 1.1rem;
      flex-shrink: 0;
    }
    .user-copy { min-width: 0; }
    .user-info .label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.15rem; }
    .user-info .email { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; overflow-wrap: anywhere; }
    .scope-panel { padding: 0.95rem 1rem; margin-bottom: 1rem; }
    .scope-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .scope-copy { min-width: 0; }
    .scope-copy .label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.18rem; }
    .scope-copy .value { font-family: var(--font-heading); font-size: 0.98rem; font-weight: 700; color: var(--text-primary); }
    .scope-badge { font-family: var(--font-mono); font-size: 0.75rem; color: var(--primary); background: rgba(13,148,136,0.1); padding: 0.35rem 0.7rem; border-radius: 999px; border: 1px solid rgba(13,148,136,0.18); white-space: nowrap; }
    .tools-panel { margin-top: 0.25rem; }
    .tools-header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 0.9rem; }
    .tools-header h2 { font-family: var(--font-heading); font-size: 1.02rem; color: var(--text-primary); font-weight: 700; margin-bottom: 0.25rem; }
    .tools-header p { color: var(--text-secondary); font-size: 0.85rem; line-height: 1.5; }
    .tools-count {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.74rem;
      font-weight: 700;
      color: var(--primary);
      background: rgba(13,148,136,0.1);
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-family: var(--font-mono);
      white-space: nowrap;
    }
    .tool-sections { display: grid; gap: 0.95rem; }
    .tool-section {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: linear-gradient(180deg, #fff, #FAFCFE);
      overflow: hidden;
    }
    .tool-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.9rem 1rem;
      border-bottom: 1px solid var(--border);
      background: rgba(248,250,252,0.9);
    }
    .tool-section-title { display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
    .tool-section-title .section-icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(249,115,22,0.12);
      color: var(--secondary);
      flex-shrink: 0;
    }
    .tool-section-title .copy { min-width: 0; }
    .tool-section-title h3 { font-family: var(--font-heading); font-size: 0.96rem; color: var(--text-primary); font-weight: 700; margin-bottom: 0.15rem; }
    .tool-section-title p { font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4; }
    .tool-section-count { font: 700 0.72rem var(--font-mono); color: var(--text-muted); background: #fff; border: 1px solid var(--border); padding: 0.3rem 0.6rem; border-radius: 999px; white-space: nowrap; }
    .tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; padding: 0.9rem 1rem 1rem; }
    .tool-card {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 0.9rem;
      background: #fff;
      box-shadow: 0 10px 18px -16px rgba(15,23,42,0.35);
    }
    .tool-card-top { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.65rem; }
    .tool-icon {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
      background: rgba(13,148,136,0.12);
      flex-shrink: 0;
    }
    .tool-copy { flex: 1; min-width: 0; }
    .tool-name { font-family: var(--font-heading); font-weight: 700; font-size: 0.93rem; color: var(--text-primary); margin-bottom: 0.18rem; text-transform: capitalize; }
    .tool-group { font-size: 0.75rem; color: var(--text-muted); }
    .tool-index {
      font: 700 0.7rem var(--font-mono);
      color: var(--secondary);
      background: rgba(249,115,22,0.12);
      border-radius: 999px;
      padding: 0.28rem 0.5rem;
      white-space: nowrap;
    }
    .tool-desc { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.7rem; }
    .tool-tags { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .tool-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.55rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font: 600 0.7rem var(--font-mono);
    }
    .footer-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
    .btn-primary, .btn-secondary {
      flex: 1;
      border: none;
      padding: 0.9rem 1rem;
      border-radius: 14px;
      font-family: var(--font-heading);
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.55rem;
      min-height: 48px;
    }
    .btn-primary { background: var(--primary); color: white; box-shadow: 0 12px 20px -14px rgba(13,148,136,0.8); }
    .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
    .btn-secondary { background: var(--bg-tertiary); color: var(--text-secondary); }
    .btn-secondary:hover { background: var(--border); transform: translateY(-1px); }
    .security-note {
      margin-top: 0.9rem;
      padding: 0.8rem 0.95rem;
      border-radius: 14px;
      border: 1px dashed var(--border-strong);
      background: rgba(248,250,252,0.8);
      color: var(--text-secondary);
      font-size: 0.82rem;
      line-height: 1.55;
    }
    .security-note strong { color: var(--text-primary); }
    @media (max-width: 900px) {
      body { padding: 16px; }
      .card-inner { padding: 20px; }
      .hero { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
      .tool-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .card-header { flex-direction: column; align-items: flex-start; }
      .tools-header { flex-direction: column; align-items: flex-start; }
      .footer-actions { flex-direction: column; }
      .scope-row { flex-direction: column; align-items: flex-start; }
      .scope-badge { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-inner">
      <div class="card-header">
        <div class="brand">
          ${params.logoUrl ? `<img src="${params.logoUrl}" alt="Carglyn" class="logo">` : `<span class="logo-mark"><span class="material-symbols-rounded" style="font-size:1.65rem">local_shipping</span></span><span class="logo-text">Carglyn</span>`}
        </div>
        <span class="header-badge"><span class="material-symbols-rounded" style="font-size:1rem">shield</span> Confirmación segura</span>
      </div>

      <div class="hero">
        <div>
          <h1 class="title">Autorizar conexión</h1>
          <p class="subtitle"><strong>${escapeHtml(params.clientName)}</strong> solicita acceso a tu cuenta de <strong>Carglyn</strong> para usar herramientas MCP desde una app externa.</p>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="label">Herramientas</div>
              <div class="value">${params.toolCount}</div>
              <div class="note">Acciones que esta integración podrá ejecutar.</div>
            </div>
            <div class="summary-card">
              <div class="label">Categorías</div>
              <div class="value">${params.groupCount}</div>
              <div class="note">Agrupadas por tipo de operación.</div>
            </div>
            <div class="summary-card">
              <div class="label">Ámbito</div>
              <div class="value" style="font-size:0.98rem">mcp:tools</div>
              <div class="note">Permisos limitados a herramientas del servidor.</div>
            </div>
          </div>

          <div class="user-info">
            <span class="material-symbols-rounded icon">person</span>
            <div class="user-copy">
              <div class="label">Cuenta activa</div>
              <div class="email">${escapeHtml(params.userEmail)}</div>
            </div>
          </div>

          <div class="scope-panel">
            <div class="scope-row">
              <div class="scope-copy">
                <div class="label">Permiso solicitado</div>
                <div class="value">Acceso MCP para automatizar acarreos</div>
              </div>
              <div class="scope-badge">${escapeHtml(params.scope)}</div>
            </div>
          </div>

          <div class="security-note">
            <strong>Revisa antes de permitir:</strong> esta app solo recibirá acceso a las herramientas listadas abajo. Puedes denegar si no reconoces el cliente o la operación solicitada.
          </div>
        </div>

        <div class="tools-panel">
          <div class="tools-header">
            <div>
              <h2>Herramientas disponibles</h2>
              <p>Se muestran agrupadas para que puedas identificar rápidamente qué hará la integración.</p>
            </div>
            <span class="tools-count">${params.toolCount} herramientas</span>
          </div>
          <div class="tool-sections">
            ${params.toolSectionsHtml}
          </div>
        </div>
      </div>

      <form method="POST" action="${params.actionUrl}">
        ${params.hiddenFields}
        <div class="footer-actions">
          <button type="submit" name="confirm" value="no" class="btn-secondary"><span class="material-symbols-rounded" style="font-size:1.125rem">close</span> Denegar</button>
          <button type="submit" name="confirm" value="yes" class="btn-primary"><span class="material-symbols-rounded" style="font-size:1.125rem">check</span> Permitir</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`
}

oauthApp.get('/oauth/authorize', async (c) => {
  try {
    const query = c.req.query()
    const responseType = query.response_type
    const clientId = query.client_id
    const redirectUri = query.redirect_uri
    const codeChallenge = query.code_challenge
    const codeChallengeMethod = query.code_challenge_method
    const state = query.state || ''
    const scope = query.scope || 'mcp:tools'

    if (responseType !== 'code') {
      return c.redirect(`${redirectUri}?error=unsupported_response_type&state=${encodeURIComponent(state)}`)
    }

    const client = await getOAuthClientByClientId(clientId)
    if (!client) {
      return c.redirect(`${redirectUri}?error=invalid_client&state=${encodeURIComponent(state)}`)
    }

    if (!client.redirectUris.includes(redirectUri)) {
      return c.redirect(`${redirectUri}?error=invalid_redirect_uri&state=${encodeURIComponent(state)}`)
    }

    // ── Session verification ────────────────────────────────────────────────
    // Session token sources:
    //   1. Cookie `__session` (seteada por Clerk via JS SDK / same-origin)
    //   2. Query param `session_token` (pasado por Clerk JS SDK al redirect)
    const cookieHeader = c.req.header('cookie')
    const sessionToken = parseSessionCookie(cookieHeader) || query.session_token || null

    let clerkId: string | null = null
    if (sessionToken) {
      try {
        const session = await verifyToken(sessionToken, { secretKey: process.env.CLERK_SECRET_KEY })
        clerkId = session.sub
      } catch {
        clerkId = null
      }
    }

    // ── No session → redirect al frontend para autenticación ────────────────
    // El frontend tiene Clerk configurado y puede obtener el session_token.
    // Redirige de vuelta a este endpoint con el token.
    if (!clerkId) {
      const frontendUrl = process.env.FRONTEND_URL
      if (!frontendUrl) {
        return jsonResponse({ error: 'server_error', error_description: 'FRONTEND_URL not configured' }, 500)
      }
      const backendAuthorizeUrl = `${baseUrl()}/oauth/authorize?${new URLSearchParams(query).toString()}`
      const frontendOAuthUrl = `${frontendUrl}/oauth/login?redirect=${encodeURIComponent(backendAuthorizeUrl)}`
      return c.redirect(frontendOAuthUrl)
    }

    let userEmail = clerkId
    try {
      const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      })
      if (res.ok) {
        const userData = await res.json() as any
        if (userData.email_addresses?.[0]?.email_address) {
          userEmail = userData.email_addresses[0].email_address
        }
      }
    } catch {
      // Fallback: use clerkId as email display
    }

    // Ensure all tools are registered before listing
    registerAllTools()

    const tools = listTools().sort((a, b) => a.name.localeCompare(b.name))
    const toolSections = [
      {
        label: 'Pedidos y confirmaciones',
        icon: 'receipt_long',
        description: 'Crear, revisar, aceptar y cerrar acarreos desde el flujo principal.',
      },
      {
        label: 'Operación del conductor',
        icon: 'local_shipping',
        description: 'Búsqueda, oferta, viaje y comprobantes de entrega.',
      },
      {
        label: 'Comunicación y consulta',
        icon: 'forum',
        description: 'Mensajería, perfiles públicos y soporte de negociación.',
      },
    ].map((section) => {
      const sectionTools = tools.filter((tool) => toolGroup(tool.name).label === section.label)
      if (!sectionTools.length) return ''

      const cards = sectionTools.map((tool, index) => {
        const presentation = toolGroup(tool.name)
        const icon = toolIcon(tool.name)
        return `
        <article class="tool-card">
          <div class="tool-card-top">
            <div class="tool-icon"><span class="material-symbols-rounded" style="font-size:1.15rem">${icon}</span></div>
            <div class="tool-copy">
              <div class="tool-name">${escapeHtml(tool.name.replace(/_/g, ' '))}</div>
              <div class="tool-group">${escapeHtml(presentation.label)}</div>
            </div>
            <span class="tool-index">${index + 1}/${sectionTools.length}</span>
          </div>
          <p class="tool-desc">${escapeHtml(tool.description)}</p>
          <div class="tool-tags">
            <span class="tool-tag"><span class="material-symbols-rounded" style="font-size:0.85rem">${presentation.icon}</span> ${escapeHtml(presentation.note)}</span>
            <span class="tool-tag">${escapeHtml(toolAudience(tool.name))}</span>
          </div>
        </article>`
      }).join('')

      return `
      <section class="tool-section">
        <div class="tool-section-header">
          <div class="tool-section-title">
            <span class="section-icon"><span class="material-symbols-rounded" style="font-size:1.05rem">${section.icon}</span></span>
            <div class="copy">
              <h3>${escapeHtml(section.label)}</h3>
              <p>${escapeHtml(section.description)}</p>
            </div>
          </div>
          <span class="tool-section-count">${sectionTools.length} tools</span>
        </div>
        <div class="tool-grid">
          ${cards}
        </div>
      </section>`
    }).filter(Boolean).join('\n')

    const hiddenFields = Object.entries(query)
      .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v || '')}">`)
      .join('\n      ')

    const actionUrl = `${baseUrl()}/oauth/authorize`
    const frontendUrl = process.env.FRONTEND_URL || ''
    const logoUrl = frontendUrl ? `${frontendUrl}/logos/Carglylogo.png` : ''

    const html = buildConsentHtml({
      clientName: client.clientName || client.clientId,
      userEmail,
      scope,
      actionUrl,
      hiddenFields,
      toolSectionsHtml: toolSections,
      logoUrl,
      toolCount: tools.length,
      groupCount: toolSections ? toolSections.split('<section').length - 1 : 0,
    })

    return c.html(html)
  } catch {
    return jsonResponse({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

oauthApp.post('/oauth/authorize', async (c) => {
  try {
    const body = await c.req.parseBody<Record<string, string>>()
    const confirm = body.confirm
    const clientId = body.client_id
    const redirectUri = body.redirect_uri
    const state = body.state || ''
    const codeChallenge = body.code_challenge
    const codeChallengeMethod = body.code_challenge_method
    const scope = body.scope || 'mcp:tools'

    if (confirm !== 'yes') {
      return c.redirect(`${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`)
    }

    const client = await getOAuthClientByClientId(clientId)
    if (!client) {
      return c.redirect(`${redirectUri}?error=invalid_client&state=${encodeURIComponent(state)}`)
    }

    if (!client.redirectUris.includes(redirectUri)) {
      return c.redirect(`${redirectUri}?error=invalid_redirect_uri&state=${encodeURIComponent(state)}`)
    }

    const cookieHeader = c.req.header('cookie')
    const sessionToken = parseSessionCookie(cookieHeader) || body.session_token || null
    if (!sessionToken) {
      return c.redirect(`${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`)
    }

    let clerkId: string
    try {
      const session = await verifyToken(sessionToken, { secretKey: process.env.CLERK_SECRET_KEY })
      clerkId = session.sub
    } catch {
      return c.redirect(`${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`)
    }

    const code = generateAuthCode()
    await saveOAuthCode({
      code,
      clientId,
      clerkId,
      codeChallenge: codeChallenge || '',
      codeChallengeMethod: codeChallengeMethod || '',
      redirectUri,
      scope,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    const params = new URLSearchParams({ code })
    if (state) params.set('state', state)
    const redirectTarget = `${redirectUri}?${params.toString()}`
    return c.redirect(redirectTarget)
  } catch {
    return jsonResponse({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

// ── Token Endpoint ─────────────────────────────────────────────────────────

oauthApp.post('/oauth/token', async (c) => {
  if (!rateLimited(c)) return c.res

  try {
    const authHeader = c.req.header('authorization')
    const auth = parseBasicAuth(authHeader)
    if (!auth) {
      return jsonResponse({ error: 'invalid_client', error_description: 'Missing or invalid Authorization header' }, 401)
    }

    const body = await c.req.parseBody<Record<string, string>>()
    const grantType = body.grant_type

    if (grantType === 'authorization_code') {
      const result = await exchangeAuthorizationCode({
        code: body.code,
        codeVerifier: body.code_verifier,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        redirectUri: body.redirect_uri,
      })

      return c.json({
        access_token: result.access_token,
        token_type: 'Bearer',
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        scope: 'mcp:tools',
      })
    }

    if (grantType === 'refresh_token') {
      const result = await refreshAccessToken({
        refreshToken: body.refresh_token,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
      })

      return c.json({
        access_token: result.access_token,
        token_type: 'Bearer',
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        scope: 'mcp:tools',
      })
    }

    return jsonResponse({ error: 'unsupported_grant_type', error_description: `Grant type '${grantType}' is not supported` }, 400)
  } catch (err) {
    if (err instanceof OAuthError) {
      return new Response(JSON.stringify({ error: err.error, error_description: err.description }), {
        status: err.statusCode,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return jsonResponse({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

// ── Token Revocation ───────────────────────────────────────────────────────

oauthApp.post('/oauth/revoke', async (c) => {
  try {
    const body = await c.req.parseBody<Record<string, string>>()

    if (body.token) {
      const existing = await getOAuthTokenByTokenId(body.token)
      if (existing) {
        await revokeOAuthToken(body.token)
      }
    }

    return c.json({}, 200)
  } catch {
    return jsonResponse({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

export default oauthApp
