import { createHash, randomBytes } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import { signMcpToken, getMcpServerUrl } from './jwt'
import { getOAuthClientByClientId, saveOAuthClient } from '../models/oauthClient'
import { getOAuthCodeByCode, deleteOAuthCode, saveOAuthToken, revokeOAuthToken, getOAuthTokenByTokenId } from '../models/oauthToken'

export class OAuthError extends Error {
  public statusCode: number
  constructor(
    public error: string,
    public description: string,
    statusCode = 400
  ) {
    super(description)
    this.name = 'OAuthError'
    this.statusCode = statusCode
  }
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  return generateCodeChallenge(verifier) === challenge
}

export function generateAuthCode(): string {
  return randomBytes(16).toString('hex')
}

export async function exchangeAuthorizationCode(
  params: {
    code: string
    codeVerifier?: string
    clientId: string
    clientSecret: string
    redirectUri: string
  }
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const reqId = crypto.randomUUID().slice(0, 8)

  console.log(`[OAuthSvc:${reqId}] 🔄 exchangeAuthorizationCode started: code=${params.code?.slice(0, 8)}..., clientId=${params.clientId?.slice(0, 12)}..., hasVerifier=${!!params.codeVerifier}`)

  const client = await getOAuthClientByClientId(params.clientId)
  if (!client) {
    console.log(`[OAuthSvc:${reqId}] ❌ Client not found: ${params.clientId?.slice(0, 12)}...`)
    throw new OAuthError('invalid_client', 'Client not found')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Client found: name=${client.clientName}`)

  const secretValid = await compare(params.clientSecret, client.clientSecretHash)
  if (!secretValid) {
    console.log(`[OAuthSvc:${reqId}] ❌ Client secret mismatch`)
    throw new OAuthError('invalid_client', 'Invalid client secret')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Client secret verified`)

  const authCode = await getOAuthCodeByCode(params.code)
  if (!authCode) {
    console.log(`[OAuthSvc:${reqId}] ❌ Auth code not found or expired: ${params.code?.slice(0, 8)}...`)
    throw new OAuthError('invalid_grant', 'Authorization code not found or expired')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Auth code found: clerkId=${authCode.clerkId}, scope=${authCode.scope}, expiresAt=${authCode.expiresAt.toISOString()}`)

  if (authCode.clientId !== params.clientId) {
    console.log(`[OAuthSvc:${reqId}] ❌ Client ID mismatch: code belongs to ${authCode.clientId?.slice(0, 12)}..., request uses ${params.clientId?.slice(0, 12)}...`)
    throw new OAuthError('invalid_grant', 'Authorization code does not belong to this client')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Client ID matches`)

  if (authCode.codeChallengeMethod === 'S256' && params.codeVerifier) {
    const pkceValid = verifyPkce(params.codeVerifier, authCode.codeChallenge)
    if (!pkceValid) {
      console.log(`[OAuthSvc:${reqId}] ❌ PKCE verification failed`)
      throw new OAuthError('invalid_grant', 'PKCE verification failed')
    }
    console.log(`[OAuthSvc:${reqId}] ✅ PKCE verified (S256)`)
  } else {
    console.log(`[OAuthSvc:${reqId}] ⚠️ PKCE skipped: method=${authCode.codeChallengeMethod}, hasVerifier=${!!params.codeVerifier}`)
  }

  if (authCode.redirectUri !== params.redirectUri) {
    console.log(`[OAuthSvc:${reqId}] ❌ Redirect URI mismatch: stored=${authCode.redirectUri}, request=${params.redirectUri}`)
    throw new OAuthError('invalid_grant', 'Redirect URI mismatch')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Redirect URI matches`)

  await deleteOAuthCode(params.code)
  console.log(`[OAuthSvc:${reqId}] 🗑️ Auth code deleted`)

  const iss = getMcpServerUrl()
  console.log(`[OAuthSvc:${reqId}] 🔑 Signing MCP token: iss=${iss}, sub=${authCode.clerkId}, aud=${iss}/mcp`)
  const accessToken = signMcpToken({
    sub: authCode.clerkId,
    aud: `${iss}/mcp`,
    iss,
    scope: authCode.scope,
    client_id: params.clientId,
  })
  console.log(`[OAuthSvc:${reqId}] ✅ MCP token signed: ${accessToken.slice(0, 30)}...`)

  const refreshToken = 'oauth_ref_' + randomBytes(24).toString('hex')
  console.log(`[OAuthSvc:${reqId}] 💾 Saving refresh token: ${refreshToken.slice(0, 20)}...`)
  await saveOAuthToken({
    tokenId: refreshToken,
    clientId: params.clientId,
    clerkId: authCode.clerkId,
    scope: authCode.scope,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
  console.log(`[OAuthSvc:${reqId}] ✅ Refresh token saved (expires in 30 days)`)

  console.log(`[OAuthSvc:${reqId}] ✅ Exchange complete — returning tokens`)
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 }
}

export async function refreshAccessToken(
  params: {
    refreshToken: string
    clientId: string
    clientSecret: string
  }
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const reqId = crypto.randomUUID().slice(0, 8)

  console.log(`[OAuthSvc:${reqId}] 🔄 refreshAccessToken started: refreshToken=${params.refreshToken?.slice(0, 20)}..., clientId=${params.clientId?.slice(0, 12)}...`)

  const client = await getOAuthClientByClientId(params.clientId)
  if (!client) {
    console.log(`[OAuthSvc:${reqId}] ❌ Client not found: ${params.clientId?.slice(0, 12)}...`)
    throw new OAuthError('invalid_client', 'Client not found')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Client found: name=${client.clientName}`)

  const secretValid = await compare(params.clientSecret, client.clientSecretHash)
  if (!secretValid) {
    console.log(`[OAuthSvc:${reqId}] ❌ Client secret mismatch`)
    throw new OAuthError('invalid_client', 'Invalid client secret')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Client secret verified`)

  const existingToken = await getOAuthTokenByTokenId(params.refreshToken)
  if (!existingToken) {
    console.log(`[OAuthSvc:${reqId}] ❌ Refresh token not found or expired`)
    throw new OAuthError('invalid_grant', 'Refresh token not found or expired')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Refresh token found: clerkId=${existingToken.clerkId}, scope=${existingToken.scope}`)

  if (existingToken.clientId !== params.clientId) {
    console.log(`[OAuthSvc:${reqId}] ❌ Client ID mismatch: token belongs to ${existingToken.clientId?.slice(0, 12)}..., request uses ${params.clientId?.slice(0, 12)}...`)
    throw new OAuthError('invalid_grant', 'Refresh token does not belong to this client')
  }
  console.log(`[OAuthSvc:${reqId}] ✅ Client ID matches — revoking old token`)

  await revokeOAuthToken(params.refreshToken)
  console.log(`[OAuthSvc:${reqId}] 🗑️ Old refresh token revoked`)

  const iss = getMcpServerUrl()
  console.log(`[OAuthSvc:${reqId}] 🔑 Signing new MCP token: iss=${iss}, sub=${existingToken.clerkId}`)
  const accessToken = signMcpToken({
    sub: existingToken.clerkId,
    aud: `${iss}/mcp`,
    iss,
    scope: existingToken.scope,
    client_id: params.clientId,
  })
  console.log(`[OAuthSvc:${reqId}] ✅ New MCP token signed: ${accessToken.slice(0, 30)}...`)

  const newRefreshToken = 'oauth_ref_' + randomBytes(24).toString('hex')
  console.log(`[OAuthSvc:${reqId}] 💾 Saving new refresh token: ${newRefreshToken.slice(0, 20)}...`)
  await saveOAuthToken({
    tokenId: newRefreshToken,
    clientId: params.clientId,
    clerkId: existingToken.clerkId,
    scope: existingToken.scope,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
  console.log(`[OAuthSvc:${reqId}] ✅ New refresh token saved (expires in 30 days)`)

  console.log(`[OAuthSvc:${reqId}] ✅ Refresh complete — returning new tokens`)
  return { access_token: accessToken, refresh_token: newRefreshToken, expires_in: 3600 }
}

export async function registerOAuthClient(
  params: {
    clientName?: string
    redirectUris: string[]
    grantTypes?: string[]
  }
): Promise<{ clientId: string; clientSecret: string; clientSecretExpiresAt: number }> {
  const clientId = 'dcr_' + randomBytes(18).toString('base64url')
  const clientSecret = randomBytes(36).toString('base64url')
  const clientSecretHash = await hash(clientSecret, 10)

  await saveOAuthClient({
    clientId,
    clientSecretHash,
    clientName: params.clientName || clientId,
    redirectUris: params.redirectUris,
    grantTypes: params.grantTypes || ['authorization_code', 'refresh_token'],
    createdAt: new Date(),
  })

  return { client_id: clientId, client_secret: clientSecret, client_secret_expires_at: 0 }
}
