import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  // La migración anterior 20260625-create-audit-log-indexes creó índices en
  // "auditlogs" (sin guión bajo), pero el código escribe en "audit_logs" (con guión).
  // Creamos la colección correcta con sus índices.

  // Crear colección audit_logs explícitamente
  await mongoDb.createCollection('audit_logs')

  // Índice para búsqueda por usuario + acción
  await mongoDb.collection('audit_logs').createIndex(
    { clerkId: 1, action: 1 },
    { name: 'audit_user_action', background: true }
  )

  // Índice para búsqueda por entidad (toolName + resourceId)
  await mongoDb.collection('audit_logs').createIndex(
    { toolName: 1, resourceId: 1 },
    { name: 'audit_entity', background: true }
  )

  // Índice para filtrar por acción
  await mongoDb.collection('audit_logs').createIndex(
    { action: 1 },
    { name: 'audit_action', background: true }
  )

  // Índice por timestamp descendente
  await mongoDb.collection('audit_logs').createIndex(
    { createdAt: -1 },
    { name: 'audit_timestamp', background: true }
  )

  // Índice para filtrar por éxito/fallo
  await mongoDb.collection('audit_logs').createIndex(
    { success: 1, createdAt: -1 },
    { name: 'audit_success_timestamp', background: true }
  )

  console.log('✅ Colección audit_logs e índices creados')
}

export async function down(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')
  await mongoDb.collection('audit_logs').drop()
  console.log('⏪ Colección audit_logs eliminada')
}
