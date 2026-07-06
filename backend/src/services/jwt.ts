import { createHmac } from 'node:crypto'

interface McpTokenPayload {
  sub: string
  aud: string
  iss: string
  exp: number
  iat: number
  scope: string
  client_id: string
  token_type: 'Bearer'
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function encodeJson(obj: unknown): string {
  return base64url(Buffer.from(JSON.stringify(obj)))
}

function decodeJson<T>(str: string): T {
  return JSON.parse(Buffer.from(str, 'base64url').toString())
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function signMcpToken(
  payload: { sub: string; aud: string; iss: string; scope: string; client_id: string },
  expiresInSeconds = 3600
): string {
  const secret = process.env.MCP_JWT_SECRET
  if (!secret) throw new Error('MCP_JWT_SECRET not configured')

  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    sub: payload.sub,
    aud: payload.aud,
    iss: payload.iss,
    scope: payload.scope,
    client_id: payload.client_id,
    token_type: 'Bearer' as const,
    exp: now + expiresInSeconds,
    iat: now,
  }

  const headerB64 = encodeJson(header)
  const claimsB64 = encodeJson(claims)
  const signature = sign(`${headerB64}.${claimsB64}`, secret)

  return `${headerB64}.${claimsB64}.${signature}`
}

export function verifyMcpToken(token: string): McpTokenPayload | null {
  try {
    const secret = process.env.MCP_JWT_SECRET
    if (!secret) return null

    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, claimsB64, signatureB64] = parts
    const expectedSig = sign(`${headerB64}.${claimsB64}`, secret)

    if (signatureB64.length !== expectedSig.length) return null

    const sigBuf = Buffer.from(signatureB64)
    const expectedBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expectedBuf.length) return null
    if (
      !createHmac('sha256', 'constant-time')
        .update(Buffer.concat([sigBuf, expectedBuf]))
        .digest()
        .equals(
          createHmac('sha256', 'constant-time')
            .update(Buffer.concat([expectedBuf, sigBuf]))
            .digest()
        )
    )
      return null

    const claims = decodeJson<McpTokenPayload>(claimsB64)

    if (claims.exp * 1000 < Date.now()) return null

    return claims
  } catch {
    return null
  }
}

export function getMcpServerUrl(): string {
  return process.env.MCP_PUBLIC_URL || 'http://localhost:3000'
}

export type { McpTokenPayload }
