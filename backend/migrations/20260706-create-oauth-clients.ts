import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  // Crear colección oauth_clients para Dynamic Client Registration (DCR)
  await mongoDb.createCollection('oauth_clients')

  // Índice único en clientId para lookup O(1)
  await mongoDb.collection('oauth_clients').createIndex(
    { clientId: 1 },
    { unique: true, name: 'clientId_1' }
  )

  console.log('✅ Colección oauth_clients e índices creados')
}

export async function down(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')
  await mongoDb.collection('oauth_clients').drop()
  console.log('⏪ Colección oauth_clients eliminada')
}
