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
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const client = await getOAuthClientByClientId(params.clientId)
  if (!client) throw new OAuthError('invalid_client', 'Client not found')

  const secretValid = await compare(params.clientSecret, client.clientSecretHash)
  if (!secretValid) throw new OAuthError('invalid_client', 'Invalid client secret')

  const authCode = await getOAuthCodeByCode(params.code)
  if (!authCode) throw new OAuthError('invalid_grant', 'Authorization code not found or expired')

  if (authCode.clientId !== params.clientId) {
    throw new OAuthError('invalid_grant', 'Authorization code does not belong to this client')
  }

  if (authCode.codeChallengeMethod === 'S256' && params.codeVerifier) {
    if (!verifyPkce(params.codeVerifier, authCode.codeChallenge)) {
      throw new OAuthError('invalid_grant', 'PKCE verification failed')
    }
  }

  if (authCode.redirectUri !== params.redirectUri) {
    throw new OAuthError('invalid_grant', 'Redirect URI mismatch')
  }

  await deleteOAuthCode(params.code)

  const iss = getMcpServerUrl()
  const accessToken = signMcpToken({
    sub: authCode.clerkId,
    aud: `${iss}/mcp`,
    iss,
    scope: authCode.scope,
    client_id: params.clientId,
  })

  const refreshToken = 'oauth_ref_' + randomBytes(24).toString('hex')
  await saveOAuthToken({
    tokenId: refreshToken,
    clientId: params.clientId,
    clerkId: authCode.clerkId,
    scope: authCode.scope,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  return { accessToken, refreshToken, expiresIn: 3600 }
}

export async function refreshAccessToken(
  params: {
    refreshToken: string
    clientId: string
    clientSecret: string
  }
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const client = await getOAuthClientByClientId(params.clientId)
  if (!client) throw new OAuthError('invalid_client', 'Client not found')

  const secretValid = await compare(params.clientSecret, client.clientSecretHash)
  if (!secretValid) throw new OAuthError('invalid_client', 'Invalid client secret')

  const existingToken = await getOAuthTokenByTokenId(params.refreshToken)
  if (!existingToken) throw new OAuthError('invalid_grant', 'Refresh token not found or expired')

  if (existingToken.clientId !== params.clientId) {
    throw new OAuthError('invalid_grant', 'Refresh token does not belong to this client')
  }

  await revokeOAuthToken(params.refreshToken)

  const iss = getMcpServerUrl()
  const accessToken = signMcpToken({
    sub: existingToken.clerkId,
    aud: `${iss}/mcp`,
    iss,
    scope: existingToken.scope,
    client_id: params.clientId,
  })

  const newRefreshToken = 'oauth_ref_' + randomBytes(24).toString('hex')
  await saveOAuthToken({
    tokenId: newRefreshToken,
    clientId: params.clientId,
    clerkId: existingToken.clerkId,
    scope: existingToken.scope,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  return { accessToken, refreshToken: newRefreshToken, expiresIn: 3600 }
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

  return { clientId, clientSecret, clientSecretExpiresAt: 0 }
}
