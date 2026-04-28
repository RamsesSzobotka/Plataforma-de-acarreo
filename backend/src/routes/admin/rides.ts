import { Hono } from 'hono/tiny'
import { Ride } from '../../models/ride'
import { User } from '../../models/user'

const app = new Hono()

app.get('/', async (c) => {
  try {
    const status = c.req.query('status')
    const clientId = c.req.query('clientId')
    const driverId = c.req.query('driverId')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    const query: Record<string, unknown> = {}
    if (status) query.status = status
    if (clientId) query.clientId = clientId
    if (driverId) query.driverId = driverId

    const skip = (page - 1) * limit
    const [rides, total] = await Promise.all([
      Ride.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Ride.countDocuments(query)
    ])

    // Obtener info de usuarios
    const clientIds = [...new Set(rides.map(r => r.clientId))]
    const assignedDriverIds = [...new Set(rides.map(r => r.driverId).filter(Boolean))]
    const userIds = [...new Set([...clientIds, ...assignedDriverIds])]
    
    const users = await User.find({ clerkId: { $in: userIds } })
      .select('email firstName lastName imageUrl role')
    const usersMap = new Map(users.map(u => [u.clerkId, u]))

    const ridesWithUsers = rides.map(r => ({
      ...r.toObject(),
      client: usersMap.get(r.clientId) || null,
      driver: r.driverId ? usersMap.get(r.driverId) || null : null
    }))

    return c.json({
      rides: ridesWithUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching rides:', error)
    return c.json({ error: 'Error fetching rides' }, 500)
  }
})

app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const ride = await Ride.findById(id)
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    const [client, driver] = await Promise.all([
      User.findOne({ clerkId: ride.clientId }),
      ride.driverId ? User.findOne({ clerkId: ride.driverId }) : Promise.resolve(null)
    ])

    return c.json({
      ...ride.toObject(),
      client,
      driver
    })
  } catch (error) {
    console.error('Error fetching ride:', error)
    return c.json({ error: 'Error fetching ride' }, 500)
  }
})

app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

    const ride = await Ride.findById(id)
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    // Campos que admin puede editar
    const allowedFields = ['finalPrice', 'notes', 'cancellationReason']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (ride as Record<string, unknown>)[field] = body[field]
      }
    }

    await ride.save()
    return c.json(ride)
  } catch (error) {
    console.error('Error updating ride:', error)
    return c.json({ error: 'Error updating ride' }, 500)
  }
})

app.patch('/cancel/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({})) as { reason: string }
    const { reason } = body

    const ride = await Ride.findById(id)
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    ride.status = 'cancelled'
    ride.cancellationReason = reason || 'Cancelado por admin'
    await ride.save()

    return c.json(ride)
  } catch (error) {
    console.error('Error canceling ride:', error)
    return c.json({ error: 'Error canceling ride' }, 500)
  }
})

export default app