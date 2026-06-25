import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  // Add 'refunded' to the ride status enum
  // MongoDB doesn't enforce enums at DB level, but we want to
  // update any existing rides that might need this status
  // Also add an index on status + driverId for better query performance
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')
  await mongoDb.collection('rides').createIndex(
    { status: 1, driverId: 1 },
    { name: 'status_driver', background: true }
  )
}

export async function down(db: Connection): Promise<void> {
  // Drop the index we created
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')
  await mongoDb.collection('rides').dropIndex('status_driver')
}
