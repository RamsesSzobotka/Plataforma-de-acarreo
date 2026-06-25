import { connectDB } from '../db/mongo'
import { mongoose } from '../db/mongo'

async function verAuditoria() {
  try {
    await connectDB()
    console.log('✅ Conectado a MongoDB\n')

    const db = mongoose.connection.db
    if (!db) {
      throw new Error('No se pudo obtener la instancia de la base de datos')
    }

    const logs = await db
      .collection('auditlogs')
      .find({})
      .sort({ 'metadata.timestamp': -1 })
      .limit(20)
      .toArray()

    const rows = logs.map((log, i) => ({
      '#': i + 1,
      acción: log.action || '-',
      usuario: log.userId
        ? log.userId.toString().slice(0, 12)
        : 'sistema',
      rol: log.userRole || '-',
      entidad: `${log.entityType || '?'}:${(log.entityId?.toString() || '?').slice(0, 10)}`,
      ip: log.metadata?.ip || '-',
      fecha: log.metadata?.timestamp
        ? new Date(log.metadata.timestamp).toLocaleString('es-PA', {
            timeZone: 'America/Panama',
          })
        : '-',
    }))

    console.table(rows)
    console.log(`\nTotal: ${logs.length} logs`)

    await mongoose.disconnect()
    console.log('🔌 Desconectado de MongoDB')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  }
}

verAuditoria()
