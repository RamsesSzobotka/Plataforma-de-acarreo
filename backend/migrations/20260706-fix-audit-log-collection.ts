import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  // Eliminar colección anterior "audit_logs" si existe
  const collections = await mongoDb.listCollections({ name: 'audit_logs' }).toArray()
  if (collections.length > 0) {
    await mongoDb.collection('audit_logs').drop()
    console.log('🗑️ Colección anterior audit_logs eliminada')
  }

  // Crear colección mcpAuditLogs con sus índices
  await mongoDb.createCollection('mcpAuditLogs')

  // Índice para búsqueda por usuario + acción
  await mongoDb.collection('mcpAuditLogs').createIndex(
    { clerkId: 1, action: 1 },
    { name: 'audit_user_action', background: true }
  )

  // Índice para búsqueda por entidad (toolName + resourceId)
  await mongoDb.collection('mcpAuditLogs').createIndex(
    { toolName: 1, resourceId: 1 },
    { name: 'audit_entity', background: true }
  )

  // Índice para filtrar por acción
  await mongoDb.collection('mcpAuditLogs').createIndex(
    { action: 1 },
    { name: 'audit_action', background: true }
  )

  // Índice por timestamp descendente
  await mongoDb.collection('mcpAuditLogs').createIndex(
    { createdAt: -1 },
    { name: 'audit_timestamp', background: true }
  )

  // Índice para filtrar por éxito/fallo
  await mongoDb.collection('mcpAuditLogs').createIndex(
    { success: 1, createdAt: -1 },
    { name: 'audit_success_timestamp', background: true }
  )

  console.log('✅ Colección mcpAuditLogs e índices creados')
}

export async function down(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')
  const collections = await mongoDb.listCollections({ name: 'mcpAuditLogs' }).toArray()
  if (collections.length > 0) {
    await mongoDb.collection('mcpAuditLogs').drop()
    console.log('⏪ Colección mcpAuditLogs eliminada')
  }
}
