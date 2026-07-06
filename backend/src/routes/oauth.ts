import { Hono } from 'hono/tiny'
import { verifyToken } from '@clerk/clerk-sdk-node'
import { getOAuthClientByClientId } from '../models/oauthClient'
import { getOAuthCodeByCode, getOAuthTokenByTokenId, revokeOAuthToken, saveOAuthCode } from '../models/oauthToken'
import { exchangeAuthorizationCode, refreshAccessToken, registerOAuthClient, OAuthError, generateAuthCode } from '../services/oauth'
import { getMcpServerUrl } from '../services/jwt'

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

function rateLimited(c: any, maxRequests = 300): boolean {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
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
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    client_registration_types_supported: ['automatic'],
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

    console.log(`[OAuth] DCR: registered client ${result.clientId} with ${body.redirect_uris.length} redirect URIs`)

    return c.json(result, 201)
  } catch (err) {
    if (err instanceof OAuthError) {
      return c.json({ error: err.error, error_description: err.description }, err.statusCode)
    }
    throw err
  }
})

// ── Authorization Endpoint ─────────────────────────────────────────────────

const CONSENT_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Autorizar conexi\u00f3n \u2014 Plataforma de Acarreos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; background: #F8FAFC; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1rem; }
    .card { background: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 2rem; max-width: 420px; width: 100%; }
    .logo { display: flex; align-items: center; gap: 0.5rem; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 1.25rem; color: #0D9488; margin-bottom: 1.5rem; }
    h1 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.5rem; color: #0F172A; margin-bottom: 0.5rem; }
    p { color: #334155; margin-bottom: 1rem; font-size: 0.95rem; line-height: 1.5; }
    .user-email { background: #F1F5F9; padding: 0.75rem; border-radius: 8px; font-weight: 600; color: #0F172A; margin-bottom: 1.5rem; }
    .scope-badge { display: inline-block; background: #F1F5F9; color: #0D9488; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; padding: 0.25rem 0.75rem; border-radius: 4px; margin-bottom: 1.5rem; }
    .buttons { display: flex; gap: 0.75rem; }
    .btn-primary { flex: 1; background: #0D9488; color: white; border: none; padding: 0.75rem; border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; font-size: 0.9rem; cursor: pointer; }
    .btn-primary:hover { background: #0F766E; }
    .btn-secondary { flex: 1; background: #F1F5F9; color: #334155; border: none; padding: 0.75rem; border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; font-size: 0.9rem; cursor: pointer; }
    .btn-secondary:hover { background: #E2E8F0; }
    .login-btn { display: block; width: 100%; background: #0D9488; color: white; border: none; padding: 0.75rem; border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; font-size: 0.9rem; text-align: center; text-decoration: none; margin-top: 1rem; }
    .login-btn:hover { background: #0F766E; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Plataforma de Acarreos</div>
    <h1>Autorizar conexi\u00f3n</h1>
    <p><strong>{{CLIENT_NAME}}</strong> solicita acceso a tu cuenta de <strong>Plataforma de Acarreos</strong>.</p>
    <div class="user-email">{{USER_EMAIL}}</div>
    <p>Permisos solicitados:</p>
    <div class="scope-badge">{{SCOPE}}</div>
    <form method="POST" action="{{ACTION_URL}}">
      {{HIDDEN_FIELDS}}
      <div class="buttons">
        <button type="submit" name="confirm" value="no" class="btn-secondary">Denegar</button>
        <button type="submit" name="confirm" value="yes" class="btn-primary">Permitir</button>
      </div>
    </form>
  </div>
</body>
</html>`

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Iniciar sesi\u00f3n \u2014 Plataforma de Acarreos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; background: #F8FAFC; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1rem; }
    .card { background: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 2rem; max-width: 420px; width: 100%; text-align: center; }
    .logo { display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 1.25rem; color: #0D9488; margin-bottom: 1.5rem; }
    h1 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.5rem; color: #0F172A; margin-bottom: 0.75rem; }
    p { color: #334155; margin-bottom: 1rem; font-size: 0.95rem; }
    .login-link { display: block; width: 100%; background: #0D9488; color: white; border: none; padding: 0.75rem; border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; font-size: 0.9rem; text-align: center; text-decoration: none; margin-top: 1rem; }
    .login-link:hover { background: #0F766E; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Plataforma de Acarreos</div>
    <h1>Inicia sesi\u00f3n para continuar</h1>
    <p>Debes iniciar sesi\u00f3n para autorizar la conexi\u00f3n con esta aplicaci\u00f3n.</p>
    <a href="{{LOGIN_URL}}" class="login-link">Iniciar sesi\u00f3n</a>
  </div>
</body>
</html>`

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

    const authHeader = c.req.header('cookie')
    const sessionToken = parseSessionCookie(authHeader)

    if (!sessionToken) {
      const currentUrl = `${baseUrl()}/oauth/authorize?${new URLSearchParams(query).toString()}`
      const signInUrl = process.env.CLERK_SIGN_IN_URL
      if (signInUrl) {
        const redirectParam = `${signInUrl}?redirect_url=${encodeURIComponent(currentUrl)}`
        return c.redirect(redirectParam)
      }
      const loginUrl = `/oauth/authorize?${new URLSearchParams(query).toString()}`
      return c.html(LOGIN_PAGE.replace('{{LOGIN_URL}}', loginUrl), 401)
    }

    let clerkId: string
    try {
      const session = await verifyToken(sessionToken, { secretKey: process.env.CLERK_SECRET_KEY })
      clerkId = session.sub
    } catch {
      const signInUrl = process.env.CLERK_SIGN_IN_URL
      if (signInUrl) {
        const currentUrl = `${baseUrl()}/oauth/authorize?${new URLSearchParams(query).toString()}`
        return c.redirect(`${signInUrl}?redirect_url=${encodeURIComponent(currentUrl)}`)
      }
      return c.html(LOGIN_PAGE.replace('{{LOGIN_URL}}', `/oauth/authorize?${new URLSearchParams(query).toString()}`), 401)
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
      // fallback: use clerkId as display
    }

    const hiddenFields = Object.entries(query)
      .map(([k, v]) => `<input type="hidden" name="${k.replace(/"/g, '&quot;')}" value="${(v || '').replace(/"/g, '&quot;')}">`)
      .join('\n      ')

    const actionUrl = `${baseUrl()}/oauth/authorize`
    const html = CONSENT_HTML
      .replace('{{CLIENT_NAME}}', client.clientName || client.clientId)
      .replace('{{USER_EMAIL}}', userEmail)
      .replace('{{SCOPE}}', scope)
      .replace('{{ACTION_URL}}', actionUrl)
      .replace('{{HIDDEN_FIELDS}}', hiddenFields)

    return c.html(html)
  } catch (err) {
    console.error('[OAuth] Authorize error:', err)
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
      console.log(`[OAuth] Consent denied: client=${clientId}`)
      return c.redirect(`${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`)
    }

    const client = await getOAuthClientByClientId(clientId)
    if (!client) {
      return c.redirect(`${redirectUri}?error=invalid_client&state=${encodeURIComponent(state)}`)
    }

    if (!client.redirectUris.includes(redirectUri)) {
      return c.redirect(`${redirectUri}?error=invalid_redirect_uri&state=${encodeURIComponent(state)}`)
    }

    const authHeader = c.req.header('cookie')
    const sessionToken = parseSessionCookie(authHeader)
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

    console.log(`[OAuth] Consent granted: client=${clientId}, clerk=${clerkId}, scope=${scope}`)

    const params = new URLSearchParams({ code })
    if (state) params.set('state', state)
    return c.redirect(`${redirectUri}?${params.toString()}`)
  } catch (err) {
    console.error('[OAuth] Authorize POST error:', err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

// ── Token Endpoint ─────────────────────────────────────────────────────────

oauthApp.post('/oauth/token', async (c) => {
  if (!rateLimited(c)) return c.res

  try {
    const auth = parseBasicAuth(c.req.header('authorization'))
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

      console.log(`[OAuth] Token exchange: client=${auth.clientId}`)

      return c.json({
        access_token: result.accessToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        refresh_token: result.refreshToken,
        scope: 'mcp:tools',
      })
    }

    if (grantType === 'refresh_token') {
      const result = await refreshAccessToken({
        refreshToken: body.refresh_token,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
      })

      console.log(`[OAuth] Token refresh: client=${auth.clientId}`)

      return c.json({
        access_token: result.accessToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        refresh_token: result.refreshToken,
        scope: 'mcp:tools',
      })
    }

    return c.json({ error: 'unsupported_grant_type', error_description: `Grant type '${grantType}' is not supported` }, 400)
  } catch (err) {
    if (err instanceof OAuthError) {
      return c.json({ error: err.error, error_description: err.description }, err.statusCode)
    }
    console.error('[OAuth] Token error:', err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

// ── Token Revocation ───────────────────────────────────────────────────────

oauthApp.post('/oauth/revoke', async (c) => {
  try {
    const body = await c.req.parseBody<Record<string, string>>()
    const token = body.token

    if (token) {
      const existing = await getOAuthTokenByTokenId(token)
      if (existing) {
        await revokeOAuthToken(token)
        console.log(`[OAuth] Token revoked: ${token.slice(0, 20)}...`)
      }
    }

    return c.json({}, 200)
  } catch (err) {
    console.error('[OAuth] Revoke error:', err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

export default oauthApp
