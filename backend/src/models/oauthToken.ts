import { db } from '../db/mongo';

export interface OAuthCode {
  code: string;
  clientId: string;
  clerkId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  scope: string;
  expiresAt: Date;
}

export interface OAuthToken {
  tokenId: string;
  clientId: string;
  clerkId: string;
  scope: string;
  expiresAt: Date;
  revokedAt?: Date;
}

export const OAUTH_CODES_COLLECTION = 'oauth_codes';
export const OAUTH_TOKENS_COLLECTION = 'oauth_tokens';

export async function createOAuthTokenIndexes() {
  const codes = db.collection(OAUTH_CODES_COLLECTION)
  const tokens = db.collection(OAUTH_TOKENS_COLLECTION)

  try {
    const codeIndexes = await codes.indexes()

    const codeUniqueExists = codeIndexes.some(idx => idx.name === 'code_1')
    if (!codeUniqueExists) {
      await codes.createIndex({ code: 1 }, { unique: true, name: 'code_1' })
    }

    const codeTtlExists = codeIndexes.some(idx => idx.name === 'expiresAt_ttl')
    if (!codeTtlExists) {
      await codes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_ttl' })
    }
  } catch (err: any) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('[OAuthToken] createOAuthTokenIndexes (codes):', err.message)
    }
  }

  try {
    const tokenIndexes = await tokens.indexes()

    const tokenIdExists = tokenIndexes.some(idx => idx.name === 'tokenId_1')
    if (!tokenIdExists) {
      await tokens.createIndex({ tokenId: 1 }, { unique: true, name: 'tokenId_1' })
    }

    const tokenTtlExists = tokenIndexes.some(idx => idx.name === 'expiresAt_ttl')
    if (!tokenTtlExists) {
      await tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_ttl' })
    }

    const clerkClientExists = tokenIndexes.some(idx => idx.name === 'clerkId_1_clientId_1')
    if (!clerkClientExists) {
      await tokens.createIndex({ clerkId: 1, clientId: 1 }, { name: 'clerkId_1_clientId_1' })
    }
  } catch (err: any) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('[OAuthToken] createOAuthTokenIndexes (tokens):', err.message)
    }
  }
}

// ── OAuthCode ──────────────────────────────────────────

export async function saveOAuthCode(code: OAuthCode): Promise<OAuthCode> {
  const collection = db.collection<OAuthCode>(OAUTH_CODES_COLLECTION)
  await collection.insertOne(code)
  return code
}

export async function getOAuthCodeByCode(code: string): Promise<OAuthCode | null> {
  const collection = db.collection<OAuthCode>(OAUTH_CODES_COLLECTION)
  return collection.findOne({ code, expiresAt: { $gt: new Date() } })
}

export async function deleteOAuthCode(code: string): Promise<void> {
  const collection = db.collection<OAuthCode>(OAUTH_CODES_COLLECTION)
  await collection.deleteOne({ code })
}

export async function deleteExpiredOAuthCodes(): Promise<number> {
  const collection = db.collection<OAuthCode>(OAUTH_CODES_COLLECTION)
  const result = await collection.deleteMany({ expiresAt: { $lte: new Date() } })
  return result.deletedCount
}

// ── OAuthToken ─────────────────────────────────────────

export async function saveOAuthToken(token: OAuthToken): Promise<OAuthToken> {
  const collection = db.collection<OAuthToken>(OAUTH_TOKENS_COLLECTION)
  await collection.insertOne(token)
  return token
}

export async function getOAuthTokenByTokenId(tokenId: string): Promise<OAuthToken | null> {
  const collection = db.collection<OAuthToken>(OAUTH_TOKENS_COLLECTION)
  return collection.findOne({ tokenId, revokedAt: null, expiresAt: { $gt: new Date() } })
}

export async function revokeOAuthToken(tokenId: string): Promise<void> {
  const collection = db.collection<OAuthToken>(OAUTH_TOKENS_COLLECTION)
  await collection.updateOne({ tokenId }, { $set: { revokedAt: new Date() } })
}

export async function revokeAllUserTokens(clerkId: string, clientId: string): Promise<number> {
  const collection = db.collection<OAuthToken>(OAUTH_TOKENS_COLLECTION)
  const result = await collection.updateMany(
    { clerkId, clientId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  )
  return result.modifiedCount
}
