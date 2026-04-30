import { Hono } from 'hono/tiny'
import { Message } from '../models/message'
import { Ride } from '../models/ride'
import { DriverContact } from '../models/driverContact'
import { broadcastToRide } from '../index'
import { authMiddleware } from '../middleware/auth'

const messages = new Hono()

const CHAT_TIMEOUT_MS = 60000 // 1 minuto

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

  // Obtener el ride
  const ride = await Ride.findById(rideId)
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }

  // Verificar estado válido para chat
  if (ride.status !== 'requested' && ride.status !== 'negotiating' && ride.status !== 'accepted') {
    return c.json({ error: 'Chat is not available for this ride status' }, 400)
  }

  // Si está en 'requested', solo drivers pueden iniciar chat
  if (ride.status === 'requested') {
    // Verificar que el sender es un driver (chequeamos en DriverContact o en users)
    // Por ahora aceptamos el mensaje del driver y creamos el contacto
    const { User } = await import('../models/user')
    const sender = await User.findOne({ clerkId: senderId })

    if (!sender || sender.role !== 'driver') {
      return c.json({ error: 'Only drivers can initiate chat when ride is pending' }, 403)
    }

    // Verificar si ya existe un driverContact activo para este driver en este ride
    let contact = await DriverContact.findOne({ driverId: senderId, rideId, isActive: true })

    if (!contact) {
      // Crear nuevo contacto
      contact = new DriverContact({
        driverId: senderId,
        clientId: ride.clientId,
        rideId: rideId,
        isActive: true
      })
      await contact.save()
    }

    // Cambiar ride a negotiating y guardar info
    ride.status = 'negotiating'
    ride.chatActiveAt = new Date()
    ride.chatInitiatedBy = senderId
    await ride.save()

    // Crear y guardar mensaje
    const message = new Message({ rideId, senderId, content })
    await message.save()

    // Emitir via WebSocket
    broadcastToRide(rideId, {
      type: 'new_message',
      data: message
    })

    return c.json(message, 201)
  }

  // Si está en 'negotiating' o 'accepted'
  // Verificar timeout: si chatActiveAt existe y pasó > 1 min, volver a 'requested'
  if (ride.status === 'negotiating' && ride.chatActiveAt) {
    const now = new Date()
    const diffMs = now.getTime() - new Date(ride.chatActiveAt).getTime()

    if (diffMs > CHAT_TIMEOUT_MS) {
      // Timeout: volver a requested
      ride.status = 'requested'
      ride.chatActiveAt = null
      // NO limpiamos chatInitiatedBy para mantener referencia
      await ride.save()

      // Verificar si el sender tiene un contact activo
      const contact = await DriverContact.findOne({ driverId: senderId, rideId, isActive: true })
      if (!contact) {
        return c.json({ error: 'Your contact has expired. Please send a new message to continue.' }, 403)
      }
      // El contact sigue activo - el cliente puede seguir chateando
      // Si es el cliente quien envía, permitir mensaje (ride queda en requested)
      // Si es el driver quien envía, necesita re-iniciar la negociación
      if (senderId !== ride.clientId) {
        // Driver debe re-iniciar - crear nuevo contact y volver a negotiating
        contact.createdAt = new Date()
        await contact.save()

        ride.status = 'negotiating'
        ride.chatActiveAt = new Date()
        ride.chatInitiatedBy = senderId
        await ride.save()
      }
    }
  }

  // Verificar access para 'negotiating'
  if (ride.status === 'negotiating') {
    // Cliente puede enviar siempre (es su ride)
    if (senderId === ride.clientId) {
      // Cliente puede enviar
    } else {
      // Es un driver - verificar que tiene contact activo
      const contact = await DriverContact.findOne({ driverId: senderId, rideId, isActive: true })
      if (!contact) {
        return c.json({ error: 'You do not have an active contact for this ride' }, 403)
      }
    }
  }

  // Verificar access para 'accepted'
  if (ride.status === 'accepted') {
    const hasAccess = ride.clientId === senderId || ride.driverId === senderId
    if (!hasAccess) {
      return c.json({ error: 'Forbidden: You do not have access to this ride' }, 403)
    }
  }

  // Actualizar chatActiveAt si está en negotiating
  if (ride.status === 'negotiating') {
    ride.chatActiveAt = new Date()
    await ride.save()
  }

  // Crear y guardar mensaje
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

// Obtener conteo de mensajes no leídos para un usuario (todos sus rides)
messages.get('/unread-count', authMiddleware, async (c) => {
  const userId = c.get('user')?.clerkId

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Obtener todos los rides donde el usuario es cliente o conductor con contacto activo
  const userContacts = await DriverContact.find({
    clientId: userId,
    isActive: true
  }).select('rideId')

  const rideIds = userContacts.map(c => c.rideId)

  // Contar mensajes no leídos por ride (donde el usuario NO es el remitente)
  const unreadCounts = await Message.aggregate([
    {
      $match: {
        rideId: { $in: rideIds },
        senderId: { $ne: userId },
        read: false
      }
    },
    {
      $group: {
        _id: '$rideId',
        count: { $sum: 1 }
      }
    }
  ])

  // Convertir a mapa { rideId: count }
  const unreadMap: Record<string, number> = {}
  unreadCounts.forEach(({ _id, count }) => {
    unreadMap[_id.toString()] = count
  })

  return c.json({ data: unreadMap })
})

export default messages