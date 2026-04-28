import { Hono } from 'hono/tiny'
import { Message } from '../models/message'
import { Ride } from '../models/ride'
import { broadcastToRide } from '../index'

const messages = new Hono()

// Obtener mensajes de un ride
messages.get('/ride/:rideId', async (c) => {
  const rideId = c.req.param('rideId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '50')
  const skip = (page - 1) * limit
  
  const [messagesList, total] = await Promise.all([
    Message.find({ rideId }).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Message.countDocuments({ rideId })
  ])
  
  return c.json({
    data: messagesList,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  })
})

// Enviar mensaje
messages.post('/', async (c) => {
  const body = await c.req.json()
  const { rideId, senderId, content } = body
  
  // Verificar que el usuario tiene acceso al ride (client or assigned driver)
  const ride = await Ride.findById(rideId)
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }
  
  const hasAccess = ride.clientId === senderId || ride.driverId === senderId
  if (!hasAccess) {
    return c.json({ error: 'Forbidden: You do not have access to this ride' }, 403)
  }
  
  // Verificar que el chat está habilitado (negotiating or accepted status)
  if (ride.status !== 'negotiating' && ride.status !== 'accepted') {
    return c.json({ error: 'Chat is not available for this ride status' }, 400)
  }
  
  const message = new Message({ rideId, senderId, content })
  await message.save()
  
  // Emitir via WebSocket
  broadcastToRide(rideId, {
    type: 'new_message',
    data: message
  })
  
  return c.json(message, 201)
})

// Marcar mensajes como leídos
messages.patch('/ride/:rideId/read', async (c) => {
  const rideId = c.req.param('rideId')
  const { userId } = await c.req.json()
  
  await Message.updateMany(
    { rideId, senderId: { $ne: userId }, read: false },
    { read: true }
  )
  
  return c.json({ success: true })
})

export default messages