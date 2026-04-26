import { Hono } from 'hono/tiny'
import { Message } from '../models/message'

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
  
  // TODO: Verificar que el usuario tiene acceso al ride
  
  const message = new Message({ rideId, senderId, content })
  await message.save()
  
  // TODO: Emitir via WebSocket
  
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