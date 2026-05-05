import { connectDB, disconnectDB } from '../db/mongo'
import { Rating } from '../models/rating'

async function main() {
  try {
    await connectDB()

    console.log('🔎 Buscando calificaciones duplicadas en la colección `ratings`...')

    const dupGroups: any[] = await Rating.aggregate([
      {
        $group: {
          _id: { rideId: '$rideId', raterId: '$raterId', ratedId: '$ratedId', role: '$role' },
          count: { $sum: 1 },
          ids: { $push: { id: '$_id', createdAt: '$createdAt' } }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ])

    if (!dupGroups || dupGroups.length === 0) {
      console.log('✅ No se encontraron duplicados.')
    } else {
      console.log(`⚠️ Se encontraron ${dupGroups.length} grupos con duplicados. Limpiando...`)
      let totalRemoved = 0

      for (const g of dupGroups) {
        const items = (g.ids || []).slice()
        // Ordenar por createdAt (más reciente primero). Si no existe createdAt, mantener orden original.
        items.sort((a: any, b: any) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return tb - ta
        })

        const keep = items[0].id
        const remove = items.slice(1).map((x: any) => x.id)

        if (remove.length > 0) {
          const res = await Rating.deleteMany({ _id: { $in: remove } })
          totalRemoved += res.deletedCount || 0
          console.log(`  - Grupo ${JSON.stringify(g._id)}: removidos ${res.deletedCount || 0}`)
        }
      }

      console.log(`🧹 Eliminadas en total: ${totalRemoved} calificaciones duplicadas.`)
    }

    // Crear índice único en la colección (si no existe)
    try {
      console.log('🔧 Creando índice único (rideId, raterId, ratedId, role) ...')
      await Rating.collection.createIndex(
        { rideId: 1, raterId: 1, ratedId: 1, role: 1 },
        { unique: true, background: true }
      )
      console.log('✅ Índice creado correctamente.')
    } catch (err) {
      console.error('❌ Error creando índice:', err)
    }

  } catch (err) {
    console.error('❌ Error ejecutando limpieza de duplicados:', err)
  } finally {
    await disconnectDB()
    process.exit(0)
  }
}

main()
