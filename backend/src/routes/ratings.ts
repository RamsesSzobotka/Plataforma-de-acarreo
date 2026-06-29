import { Hono } from 'hono/tiny'
import { authMiddleware } from '../middleware'
import { Rating } from '../models/rating'

const ratings = new Hono()

// GET /api/ratings/ride/:rideId - Obtener todas las reseñas de un ride específico
ratings.get('/ride/:rideId', authMiddleware, async (c) => {
  const rideId = c.req.param('rideId')

  try {
    const ratingsData = await Rating.find({ rideId })
      .sort({ createdAt: -1 })
      .lean()

    // Enriquecer con datos de quien calificó (rater)
    const { db } = await import('../db/mongo')
    const enrichedRatings = await Promise.all(
      ratingsData.map(async (r) => {
        let rater = null
        try {
          const userDoc = await db.collection('users').findOne(
            { clerkId: r.raterId },
            { projection: { firstName: 1, lastName: 1, imageUrl: 1 } }
          )
          if (userDoc) {
            rater = {
              firstName: userDoc.firstName,
              lastName: userDoc.lastName,
              imageUrl: userDoc.imageUrl,
            }
          }
        } catch (err) {
          console.error('Error fetching rater:', err)
        }
        return {
          _id: r._id,
          rideId: r.rideId,
          raterId: r.raterId,
          ratedId: r.ratedId,
          role: r.role,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          rater,
        }
      })
    )

    return c.json({ ratings: enrichedRatings })
  } catch (err) {
    console.error('Error fetching ride ratings:', err)
    return c.json({ error: 'Error al obtener reseñas del acarreo' }, 500)
  }
})

// GET /api/ratings/driver/:userId - Obtener reseñas de un conductor (paginated)
ratings.get('/driver/:userId', authMiddleware, async (c) => {
  const userId = c.req.param('userId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  try {
    const skip = (page - 1) * limit

    const [ratings, total] = await Promise.all([
      Rating.find({ ratedId: userId, role: 'driver' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Rating.countDocuments({ ratedId: userId, role: 'driver' }),
    ])

    // Enriquecer con datos de quien calificó (rater)
    const { db } = await import('../db/mongo')
    const enrichedRatings = await Promise.all(
      ratings.map(async (r) => {
        let rater = null
        try {
          const userDoc = await db.collection('users').findOne(
            { clerkId: r.raterId },
            { projection: { firstName: 1, lastName: 1, imageUrl: 1 } }
          )
          if (userDoc) {
            rater = {
              firstName: userDoc.firstName,
              lastName: userDoc.lastName,
              imageUrl: userDoc.imageUrl,
            }
          }
        } catch (err) {
          console.error('Error fetching rater:', err)
        }
        return {
          _id: r._id,
          rideId: r.rideId,
          raterId: r.raterId,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          rater,
        }
      })
    )

    return c.json({
      data: enrichedRatings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('Error fetching driver ratings:', err)
    return c.json({ error: 'Error al obtener reseñas' }, 500)
  }
})

export default ratings
