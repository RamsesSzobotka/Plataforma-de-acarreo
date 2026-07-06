import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  // ── oauth_codes: authorization codes (PKCE, TTL 10 min) ──────────────
  await mongoDb.createCollection('oauth_codes')

  // Índice único en code para lookup O(1)
  await mongoDb.collection('oauth_codes').createIndex(
    { code: 1 },
    { unique: true, name: 'code_1' }
  )

  // Índice TTL para expirar codes automáticamente
  await mongoDb.collection('oauth_codes').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'expiresAt_ttl' }
  )

  // ── oauth_tokens: access & refresh tokens (TTL 30 días) ──────────────
  await mongoDb.createCollection('oauth_tokens')

  // Índice único en tokenId para lookup O(1)
  await mongoDb.collection('oauth_tokens').createIndex(
    { tokenId: 1 },
    { unique: true, name: 'tokenId_1' }
  )

  // Índice TTL para expirar tokens automáticamente
  await mongoDb.collection('oauth_tokens').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'expiresAt_ttl' }
  )

  // Índice compuesto para revocar todos los tokens de un usuario + cliente
  await mongoDb.collection('oauth_tokens').createIndex(
    { clerkId: 1, clientId: 1 },
    { name: 'clerkId_1_clientId_1' }
  )

  console.log('✅ Colecciones oauth_codes y oauth_tokens e índices creados')
}

export async function down(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')
  await mongoDb.collection('oauth_codes').drop()
  await mongoDb.collection('oauth_tokens').drop()
  console.log('⏪ Colecciones oauth_codes y oauth_tokens eliminadas')
}
