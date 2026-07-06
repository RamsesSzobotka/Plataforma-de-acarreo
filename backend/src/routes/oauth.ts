import { Hono } from 'hono/tiny'
import { verifyToken } from '@clerk/clerk-sdk-node'
import { getOAuthClientByClientId } from '../models/oauthClient'
import { getOAuthCodeByCode, getOAuthTokenByTokenId, revokeOAuthToken, saveOAuthCode } from '../models/oauthToken'
import { exchangeAuthorizationCode, refreshAccessToken, registerOAuthClient, OAuthError, generateAuthCode, type DcrResponse } from '../services/oauth'
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

export function getOAuthReqId(): string {
  return crypto.randomUUID().slice(0, 8)
}

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
  console.log(`[OAuth] 📋 .well-known/oauth-protected-resource → resource=${base}/mcp`)
  return c.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ['mcp:tools'],
    bearer_token_formats_supported: ['opaque', 'jwt'],
  })
})

oauthApp.get('/.well-known/oauth-authorization-server', (c) => {
  const base = baseUrl()
  console.log(`[OAuth] 📋 .well-known/oauth-authorization-server → issuer=${base}`)
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
  const reqId = getOAuthReqId()
  const ip = getClientIp(c)
  if (!rateLimited(c)) return c.res

  try {
    const body = await c.req.json<{
      client_name?: string
      redirect_uris: string[]
      grant_types?: string[]
    }>()

    console.log(`[OAuth:${reqId}] 📝 DCR request from ${ip}: client_name=${body.client_name || '(unnamed)'}, redirect_uris=${JSON.stringify(body.redirect_uris)}, grant_types=${JSON.stringify(body.grant_types)}`)

    if (!body.redirect_uris?.length) {
      console.log(`[OAuth:${reqId}] ❌ DCR rejected: missing redirect_uris`)
      return c.json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, 400)
    }

    const result = await registerOAuthClient({
      clientName: body.client_name,
      redirectUris: body.redirect_uris,
      grantTypes: body.grant_types,
    })

    console.log(`[OAuth:${reqId}] ✅ DCR success: clientId=${result.client_id}, clientSecret=${result.client_secret.slice(0, 8)}..., ${body.redirect_uris.length} redirect URIs`)

    c.header('Cache-Control', 'no-store')
    c.header('Pragma', 'no-cache')
    return c.json(result, 201)
  } catch (err) {
    if (err instanceof OAuthError) {
      console.log(`[OAuth:${reqId}] ❌ DCR error: ${err.error} — ${err.description}`)
      return c.json({ error: err.error, error_description: err.description }, err.statusCode)
    }
    console.error(`[OAuth:${reqId}] ❌ DCR unexpected error:`, err)
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



oauthApp.get('/oauth/authorize', async (c) => {
  const reqId = getOAuthReqId()
  const ip = getClientIp(c)
  try {
    const query = c.req.query()
    const responseType = query.response_type
    const clientId = query.client_id
    const redirectUri = query.redirect_uri
    const codeChallenge = query.code_challenge
    const codeChallengeMethod = query.code_challenge_method
    const state = query.state || ''
    const scope = query.scope || 'mcp:tools'

    console.log(`[OAuth:${reqId}] 📩 Authorize GET from ${ip}: clientId=${clientId}, redirectUri=${redirectUri}, responseType=${responseType}, scope=${scope}, state=${state}, codeChallengeMethod=${codeChallengeMethod}, hasCodeChallenge=${!!codeChallenge}`)

    if (responseType !== 'code') {
      console.log(`[OAuth:${reqId}] ❌ Authorize rejected: unsupported response_type=${responseType}`)
      return c.redirect(`${redirectUri}?error=unsupported_response_type&state=${encodeURIComponent(state)}`)
    }

    const client = await getOAuthClientByClientId(clientId)
    if (!client) {
      console.log(`[OAuth:${reqId}] ❌ Authorize rejected: client not found — clientId=${clientId}`)
      return c.redirect(`${redirectUri}?error=invalid_client&state=${encodeURIComponent(state)}`)
    }
    console.log(`[OAuth:${reqId}] ✅ Client found: name=${client.clientName}, validUris=${JSON.stringify(client.redirectUris)}`)

    if (!client.redirectUris.includes(redirectUri)) {
      console.log(`[OAuth:${reqId}] ❌ Authorize rejected: redirectUri ${redirectUri} not in client's allowed URIs`)
      return c.redirect(`${redirectUri}?error=invalid_redirect_uri&state=${encodeURIComponent(state)}`)
    }

    // ── Session verification ────────────────────────────────────────────────
    // Session token sources:
    //   1. Cookie `__session` (seteada por Clerk via JS SDK / same-origin)
    //   2. Query param `session_token` (pasado por Clerk JS SDK al redirect)
    const cookieHeader = c.req.header('cookie')
    const cookiePreview = cookieHeader ? cookieHeader.slice(0, 80) + '...' : '(none)'
    const sessionToken = parseSessionCookie(cookieHeader) || query.session_token || null
    console.log(`[OAuth:${reqId}] 🔍 Session check: cookie=${cookiePreview}, hasSessionToken=${!!sessionToken}, hasQueryToken=${!!query.session_token}`)

    let clerkId: string | null = null
    if (sessionToken) {
      try {
        const session = await verifyToken(sessionToken, { secretKey: process.env.CLERK_SECRET_KEY })
        clerkId = session.sub
        console.log(`[OAuth:${reqId}] ✅ Token verified with Clerk — sub=${clerkId}`)
      } catch (err) {
        console.log(`[OAuth:${reqId}] ❌ Token verification failed: ${(err as Error).message}`)
        clerkId = null
      }
    }

    // ── No session → redirect al frontend para autenticación ────────────────
    // El frontend tiene Clerk configurado y puede obtener el session_token.
    // Redirige de vuelta a este endpoint con el token.
    if (!clerkId) {
      const frontendUrl = process.env.FRONTEND_URL
      if (!frontendUrl) {
        console.error(`[OAuth:${reqId}] ❌ FRONTEND_URL not configured`)
        return c.json({ error: 'server_error', error_description: 'FRONTEND_URL not configured' }, 500)
      }
      const backendAuthorizeUrl = `${baseUrl()}/oauth/authorize?${new URLSearchParams(query).toString()}`
      const frontendOAuthUrl = `${frontendUrl}/oauth/login?redirect=${encodeURIComponent(backendAuthorizeUrl)}`
      console.log(`[OAuth:${reqId}] 🔀 Redirecting to frontend auth → ${frontendUrl}/oauth/login`)
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
        console.log(`[OAuth:${reqId}] 👤 Clerk user fetched: email=${userEmail}`)
      } else {
        console.log(`[OAuth:${reqId}] ⚠️ Clerk user fetch failed: ${res.status}`)
      }
    } catch (err) {
      console.log(`[OAuth:${reqId}] ⚠️ Clerk user fetch error (using clerkId fallback): ${(err as Error).message}`)
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

    console.log(`[OAuth:${reqId}] ✅ Rendering consent page for client=${client.clientName}, user=${userEmail}, scope=${scope}`)
    return c.html(html)
  } catch (err) {
    console.error(`[OAuth:${reqId}] ❌ Authorize GET error:`, err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

oauthApp.post('/oauth/authorize', async (c) => {
  const reqId = getOAuthReqId()
  const ip = getClientIp(c)
  try {
    const body = await c.req.parseBody<Record<string, string>>()
    const confirm = body.confirm
    const clientId = body.client_id
    const redirectUri = body.redirect_uri
    const state = body.state || ''
    const codeChallenge = body.code_challenge
    const codeChallengeMethod = body.code_challenge_method
    const scope = body.scope || 'mcp:tools'

    console.log(`[OAuth:${reqId}] 📩 Authorize POST from ${ip}: clientId=${clientId}, confirm=${confirm}, redirectUri=${redirectUri}, scope=${scope}, state=${state}, codeChallengeMethod=${codeChallengeMethod}`)

    if (confirm !== 'yes') {
      console.log(`[OAuth:${reqId}] ❌ Consent denied by user: client=${clientId}`)
      return c.redirect(`${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`)
    }

    const client = await getOAuthClientByClientId(clientId)
    if (!client) {
      console.log(`[OAuth:${reqId}] ❌ Consent rejected: client not found — clientId=${clientId}`)
      return c.redirect(`${redirectUri}?error=invalid_client&state=${encodeURIComponent(state)}`)
    }
    console.log(`[OAuth:${reqId}] ✅ Client validated: name=${client.clientName}`)

    if (!client.redirectUris.includes(redirectUri)) {
      console.log(`[OAuth:${reqId}] ❌ Consent rejected: redirectUri mismatch — got=${redirectUri}, expected one of=${JSON.stringify(client.redirectUris)}`)
      return c.redirect(`${redirectUri}?error=invalid_redirect_uri&state=${encodeURIComponent(state)}`)
    }

    const cookieHeader = c.req.header('cookie')
    const sessionToken = parseSessionCookie(cookieHeader)
    if (!sessionToken) {
      console.log(`[OAuth:${reqId}] ❌ Consent rejected: no session cookie found`)
      return c.redirect(`${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`)
    }
    console.log(`[OAuth:${reqId}] 🔍 Session cookie found, verifying with Clerk...`)

    let clerkId: string
    try {
      const session = await verifyToken(sessionToken, { secretKey: process.env.CLERK_SECRET_KEY })
      clerkId = session.sub
      console.log(`[OAuth:${reqId}] ✅ Clerk verified: sub=${clerkId}`)
    } catch (err) {
      console.log(`[OAuth:${reqId}] ❌ Clerk verification failed: ${(err as Error).message}`)
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

    console.log(`[OAuth:${reqId}] ✅ Consent granted: client=${clientId}, clerk=${clerkId}, scope=${scope}, code=${code}`)

    const params = new URLSearchParams({ code })
    if (state) params.set('state', state)
    const redirectTarget = `${redirectUri}?${params.toString()}`
    console.log(`[OAuth:${reqId}] 🔀 Redirecting to: ${redirectTarget.slice(0, 120)}...`)
    return c.redirect(redirectTarget)
  } catch (err) {
    console.error(`[OAuth:${reqId}] ❌ Authorize POST error:`, err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

// ── Token Endpoint ─────────────────────────────────────────────────────────

oauthApp.post('/oauth/token', async (c) => {
  const reqId = getOAuthReqId()
  const ip = getClientIp(c)
  if (!rateLimited(c)) return c.res

  try {
    const authHeader = c.req.header('authorization')
    const authHeaderPreview = authHeader ? authHeader.slice(0, 30) + '...' : '(none)'
    const auth = parseBasicAuth(authHeader)
    if (!auth) {
      console.log(`[OAuth:${reqId}] ❌ Token request from ${ip}: missing/invalid Basic auth — authHeader=${authHeaderPreview}`)
      return c.json({ error: 'invalid_client', error_description: 'Missing or invalid Authorization header' }, 401)
    }

    const body = await c.req.parseBody<Record<string, string>>()
    const grantType = body.grant_type
    console.log(`[OAuth:${reqId}] 📩 Token request from ${ip}: clientId=${auth.clientId.slice(0, 12)}..., grantType=${grantType}, hasCode=${!!body.code}, hasRefresh=${!!body.refresh_token}, hasVerifier=${!!body.code_verifier}`)

    if (grantType === 'authorization_code') {
      console.log(`[OAuth:${reqId}] 🔄 Exchanging authorization_code for tokens...`)
      const result = await exchangeAuthorizationCode({
        code: body.code,
        codeVerifier: body.code_verifier,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        redirectUri: body.redirect_uri,
      })

      console.log(`[OAuth:${reqId}] ✅ Token exchange success: client=${auth.clientId.slice(0, 12)}..., accessToken=${result.access_token.slice(0, 20)}..., expiresIn=${result.expires_in}s, hasRefresh=${!!result.refresh_token}`)

      return c.json({
        access_token: result.access_token,
        token_type: 'Bearer',
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        scope: 'mcp:tools',
      })
    }

    if (grantType === 'refresh_token') {
      console.log(`[OAuth:${reqId}] 🔄 Refreshing access token...`)
      const result = await refreshAccessToken({
        refreshToken: body.refresh_token,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
      })

      console.log(`[OAuth:${reqId}] ✅ Token refresh success: client=${auth.clientId.slice(0, 12)}..., accessToken=${result.access_token.slice(0, 20)}..., expiresIn=${result.expires_in}s`)

      return c.json({
        access_token: result.access_token,
        token_type: 'Bearer',
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        scope: 'mcp:tools',
      })
    }

    console.log(`[OAuth:${reqId}] ❌ Unsupported grant_type: ${grantType}`)
    return c.json({ error: 'unsupported_grant_type', error_description: `Grant type '${grantType}' is not supported` }, 400)
  } catch (err) {
    if (err instanceof OAuthError) {
      console.log(`[OAuth:${reqId}] ❌ Token error: ${err.error} — ${err.description}`)
      return c.json({ error: err.error, error_description: err.description }, err.statusCode)
    }
    console.error(`[OAuth:${reqId}] ❌ Token unexpected error:`, err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

// ── Token Revocation ───────────────────────────────────────────────────────

oauthApp.post('/oauth/revoke', async (c) => {
  const reqId = getOAuthReqId()
  const ip = getClientIp(c)
  try {
    const body = await c.req.parseBody<Record<string, string>>()
    const token = body.token?.slice(0, 30) || '(none)'

    console.log(`[OAuth:${reqId}] 📩 Revoke request from ${ip}: token=${token}...`)

    if (body.token) {
      const existing = await getOAuthTokenByTokenId(body.token)
      if (existing) {
        await revokeOAuthToken(body.token)
        console.log(`[OAuth:${reqId}] ✅ Token revoked: clerkId=${existing.clerkId}, clientId=${existing.clientId.slice(0, 12)}...`)
      } else {
        console.log(`[OAuth:${reqId}] ⚠️ Token not found or already revoked — returning 200 per RFC`)
      }
    }

    return c.json({}, 200)
  } catch (err) {
    console.error(`[OAuth:${reqId}] ❌ Revoke error:`, err)
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500)
  }
})

export default oauthApp
