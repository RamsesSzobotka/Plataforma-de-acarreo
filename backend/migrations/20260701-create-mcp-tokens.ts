import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  // Crear colección mcp_tokens con los índices necesarios
  await db.createCollection('mcp_tokens')

  // Índice único en tokenId para lookup O(1)
  await db.collection('mcp_tokens').createIndex(
    { tokenId: 1 },
    { unique: true, name: 'tokenId_1' }
  )

  // Índice en clerkId para buscar por usuario
  await db.collection('mcp_tokens').createIndex(
    { clerkId: 1 },
    { name: 'clerkId_1' }
  )

  // Índice para buscar tokens activos (no revocados)
  await db.collection('mcp_tokens').createIndex(
    { tokenId: 1, revokedAt: 1 },
    { name: 'tokenId_revokedAt_1' }
  )

  console.log('✅ Colección mcp_tokens e índices creados')
}

export async function down(db: Connection): Promise<void> {
  await db.collection('mcp_tokens').drop()
  console.log('⏪ Colección mcp_tokens eliminada')
}