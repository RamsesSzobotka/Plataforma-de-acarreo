import { Hono } from 'hono/tiny'
import { verifyToken } from '@clerk/clerk-sdk-node'
import { getOAuthClientByClientId } from '../models/oauthClient'
import { getOAuthCodeByCode, getOAuthTokenByTokenId, revokeOAuthToken, saveOAuthCode } from '../models/oauthToken'
import { exchangeAuthorizationCode, refreshAccessToken, registerOAuthClient, OAuthError, generateAuthCode, type DcrResponse } from '../services/oauth'
import { getMcpServerUrl } from '../services/jwt'
import { listTools } from '../mcp/tools'

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function rateLimited(c: any, maxRequests = 300): boolean {
  const ip = getClientIp(c)
  const result = checkRateLimit(ip, maxRequests)
  c.header('X-RateLimit-Limit', String(maxRequests))
  c.header('X-RateLimit-Remaining', String(result.remaining))
  if (result.retryAfter) c.header('Retry-After', String(result.retryAfter))
  if (!result.allowed) {
    c.res = c.json({ error: 'too_many_requests', error_description: 'Rate limit exceeded. Try again later.', retryAfter: result.retryAfter }, 429)
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
      return c.json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, 400)
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
      return c.json({ error: err.error, error_description: err.description }, err.statusCode)
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
  toolsHtml: string
  logoUrl: string
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
      --radius: 12px;
      --radius-sm: 8px;
      --shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
      --font-heading: 'Plus Jakarta Sans', sans-serif;
      --font-body: 'Inter', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: var(--bg-secondary); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1rem; }
    .card { background: var(--bg-primary); border-radius: var(--radius); box-shadow: var(--shadow); padding: 2rem; max-width: 520px; width: 100%; }
    .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
    .card-header img.logo { height: 36px; width: auto; }
    .card-header .logo-text { font-family: var(--font-heading); font-weight: 700; font-size: 1.25rem; color: var(--primary); }
    h1 { font-family: var(--font-heading); font-size: 1.375rem; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 700; }
    .subtitle { color: var(--text-secondary); margin-bottom: 1.25rem; font-size: 0.9rem; line-height: 1.5; }
    .user-info { display: flex; align-items: center; gap: 0.625rem; background: var(--bg-tertiary); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem; }
    .user-info .icon { color: var(--text-muted); font-size: 1.25rem; }
    .user-info .email { font-weight: 600; color: var(--text-primary); font-size: 0.9rem; }
    .tools-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    .tools-header h2 { font-family: var(--font-heading); font-size: 0.925rem; color: var(--text-primary); font-weight: 600; }
    .tools-count { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; color: var(--primary); background: rgba(13,148,136,0.1); padding: 0.2rem 0.6rem; border-radius: 999px; font-family: var(--font-mono); }
    .tools-list { max-height: 340px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 1.5rem; }
    .tools-list::-webkit-scrollbar { width: 6px; }
    .tools-list::-webkit-scrollbar-track { background: transparent; }
    .tools-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    .tool-item { display: flex; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
    .tool-item:last-child { border-bottom: none; }
    .tool-item .accent { width: 3px; flex-shrink: 0; background: var(--primary); border-radius: 2px; }
    .tool-item .icon { font-size: 1.125rem; color: var(--primary); margin-top: 1px; }
    .tool-item .body { flex: 1; min-width: 0; }
    .tool-item .name { font-family: var(--font-heading); font-weight: 600; font-size: 0.8rem; color: var(--text-primary); margin-bottom: 0.15rem; }
    .tool-item .desc { font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4; }
    .scope-badge { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); background: var(--bg-tertiary); padding: 0.2rem 0.6rem; border-radius: 4px; display: inline-block; margin-bottom: 1.25rem; }
    .buttons { display: flex; gap: 0.75rem; }
    .btn-primary { flex: 1; background: var(--primary); color: white; border: none; padding: 0.75rem; border-radius: var(--radius-sm); font-family: var(--font-heading); font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { flex: 1; background: var(--bg-tertiary); color: var(--text-secondary); border: none; padding: 0.75rem; border-radius: var(--radius-sm); font-family: var(--font-heading); font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .btn-secondary:hover { background: var(--border); }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      ${params.logoUrl ? `<img src="${params.logoUrl}" alt="Carglyn" class="logo">` : `<span class="material-symbols-rounded" style="font-size:1.75rem;color:var(--primary)">local_shipping</span><span class="logo-text">Carglyn</span>`}
    </div>
    <h1>Autorizar conexión</h1>
    <p class="subtitle"><strong>${params.clientName}</strong> solicita acceso a tu cuenta de <strong>Carglyn</strong>.</p>
    <div class="user-info">
      <span class="material-symbols-rounded icon">person</span>
      <span class="email">${params.userEmail}</span>
    </div>
    <div class="tools-header">
      <h2>Herramientas disponibles</h2>
      <span class="tools-count">${params.toolsHtml.match(/tool-item/g)?.length || 0} herramientas</span>
    </div>
    <div class="tools-list">
      ${params.toolsHtml}
    </div>
    <div class="scope-badge">${params.scope}</div>
    <form method="POST" action="${params.actionUrl}">
      ${params.hiddenFields}
      <div class="buttons">
        <button type="submit" name="confirm" value="no" class="btn-secondary"><span class="material-symbols-rounded" style="font-size:1.125rem">close</span> Denegar</button>
        <button type="submit" name="confirm" value="yes" class="btn-primary"><span class="material-symbols-rounded" style="font-size:1.125rem">check</span> Permitir</button>
      </div>
    </form>
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
        return c.json({ error: 'server_error', error_description: 'FRONTEND_URL not configured' }, 500)
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

    // Build tools list
    const tools = listTools()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => {
        const icon = toolIcon(t.name)
        return `
    <div class="tool-item">
      <div class="accent"></div>
      <span class="material-symbols-rounded icon">${icon}</span>
      <div class="body">
        <div class="name">${t.name.replace(/_/g, ' ')}</div>
        <div class="desc">${escapeHtml(t.description)}</div>
      </div>
    </div>`
      })
      .join('\n      ')

    const hiddenFields = Object.entries(query)
      .map(([k, v]) => `<input type="hidden" name="${k.replace(/"/g, '&quot;')}" value="${(v || '').replace(/"/g, '&quot;')}">`)
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
      toolsHtml: tools,
      logoUrl,
    })

    return c.html(html)
  } catch {
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
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
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

// ── Token Endpoint ─────────────────────────────────────────────────────────

oauthApp.post('/oauth/token', async (c) => {
  if (!rateLimited(c)) return c.res

  try {
    const authHeader = c.req.header('authorization')
    const auth = parseBasicAuth(authHeader)
    if (!auth) {
      return c.json({ error: 'invalid_client', error_description: 'Missing or invalid Authorization header' }, 401)
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

    return c.json({ error: 'unsupported_grant_type', error_description: `Grant type '${grantType}' is not supported` }, 400)
  } catch (err) {
    if (err instanceof OAuthError) {
      return c.json({ error: err.error, error_description: err.description }, err.statusCode)
    }
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
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
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

export default oauthApp
