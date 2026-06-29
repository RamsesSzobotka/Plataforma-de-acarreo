/**
 * Servicio centralizado de calificaciones (ratings).
 * Usado tanto por REST (routes/rides.ts) como por MCP (mcp/tools/client/rate-service.ts).
 */
import { Rating } from '../models/rating'

export interface CreateRatingInput {
  rideId: string
  raterId: string
  ratedId: string
  role: 'client' | 'driver'
  rating: number
  comment?: string | null
}

export async function createRatingAndUpdateAverage(
  rideId: string,
  raterId: string,
  ratedId: string,
  role: 'client' | 'driver',
  rating: number,
  comment?: string | null,
) {
  // Validar rating 1-5
  if (!rating || rating < 1 || rating > 5) {
    throw new Error('Calificación debe estar entre 1 y 5')
  }

  // Verificar que no exista ya una calificación para este ride (1 review per ride)
  const existing = await Rating.findOne({ rideId, raterId, ratedId, role })
  if (existing) {
    throw new Error(`Ya has calificado este acarreo. Calificación existente: ${existing.rating} estrellas.`)
  }

  // Crear la calificación (rechaza duplicados explícitamente)
  const [ratingRecord] = await Rating.create([
    { rideId, raterId, ratedId, role, rating, comment: comment || null },
  ])

  // Si es calificación a driver, recalcular promedio
  if (role === 'driver') {
    try {
      const agg = await Rating.aggregate([
        { $match: { ratedId, role: 'driver' } },
        { $group: { _id: '$ratedId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])

      if (agg && agg.length > 0) {
        const { avg, count } = agg[0]
        const { Driver } = await import('../models/driver')
        await Driver.findOneAndUpdate(
          { userId: ratedId },
          { rating: Number((avg as number).toFixed(2)), totalRides: count },
          { new: true },
        )
      }
    } catch (err) {
      console.error('Error actualizando promedio de driver:', err)
    }
  }

  return ratingRecord
}
