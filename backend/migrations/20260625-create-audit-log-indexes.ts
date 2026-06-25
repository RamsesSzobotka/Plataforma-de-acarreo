import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  // Create indexes on the auditlogs collection for better query performance
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  await mongoDb.collection('auditlogs').createIndex(
    { userId: 1, action: 1 },
    { name: 'audit_user_action', background: true }
  )

  await mongoDb.collection('auditlogs').createIndex(
    { entityType: 1, entityId: 1 },
    { name: 'audit_entity', background: true }
  )

  await mongoDb.collection('auditlogs').createIndex(
    { action: 1 },
    { name: 'audit_action', background: true }
  )

  await mongoDb.collection('auditlogs').createIndex(
    { 'metadata.timestamp': -1 },
    { name: 'audit_timestamp', background: true }
  )
}

export async function down(db: Connection): Promise<void> {
  // Drop all 4 indexes we created
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  await mongoDb.collection('auditlogs').dropIndex('audit_user_action')
  await mongoDb.collection('auditlogs').dropIndex('audit_entity')
  await mongoDb.collection('auditlogs').dropIndex('audit_action')
  await mongoDb.collection('auditlogs').dropIndex('audit_timestamp')
}
