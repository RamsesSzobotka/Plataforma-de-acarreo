import { Hono } from 'hono/tiny'
import { Message } from '../models/message'
import { Ride } from '../models/ride'
import { DriverContact } from '../models/driverContact'
import { broadcastToRide } from '../services/websocket'
import { authMiddleware } from '../middleware/auth'

const messages = new Hono()

const MAX_PROPOSALS = 3

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
messages.post('/', authMiddleware, async (c) => {
  const body = await c.req.json()
  const { rideId, senderId, content } = body
  const currentUser = c.get('user')

  // Obtener el ride
  if (!/^[0-9a-fA-F]{24}$/.test(rideId)) {
    return c.json({ error: 'Ride not found' }, 404)
  }
  const ride = await Ride.findById(rideId)
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }

  // Verificar estado válido para chat
  if (ride.status !== 'requested' && ride.status !== 'accepted' &&
      ride.status !== 'in_progress' && ride.status !== 'completed') {
    return c.json({ error: 'Chat is not available for this ride status' }, 400)
  }

  // Si está en 'requested', drivers pueden iniciar chat y clientes pueden responder a contacts activos
  if (ride.status === 'requested') {
    // Primero verificar si es el cliente respondiendo a un driver que le escribió
    if (senderId === ride.clientId) {
      // Cliente: verificar que tiene al menos un contact activo
      const activeContact = await DriverContact.findOne({ rideId, isActive: true })
      if (!activeContact) {
        return c.json({ error: 'No tienes conversaciones activas con conductores' }, 403)
      }

      // Cliente puede responder - crear mensaje
      const message = new Message({ rideId, senderId, content })
      await message.save()

      broadcastToRide(rideId, {
        type: 'new_message',
        data: message
      })

      return c.json(message, 201)
    }

    // Es un driver - verificar que tiene contact o crear uno nuevo
    const { User } = await import('../models/user')
    const sender = await User.findOne({ clerkId: senderId })

    if (!sender || sender.role !== 'driver') {
      return c.json({ error: 'Only drivers can initiate chat when ride is pending' }, 403)
    }

    // Buscar o crear contact
    let contact = await DriverContact.findOne({ driverId: senderId, rideId, isActive: true })

    if (!contact) {
      // Guardar info del driver en el momento del contacto
      contact = new DriverContact({
        driverId: senderId,
        clientId: ride.clientId,
        rideId: rideId,
        isActive: true,
        driverFirstName: sender.firstName,
        driverLastName: sender.lastName,
        driverImageUrl: sender.imageUrl,
        proposalCount: 0
      })
      await contact.save()
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
  }

  // Si está en 'accepted', 'in_progress' o 'completed':
  // Cliente puede chatear si es el dueño del ride
  // Driver puede chatear si es el driver asignado
  if (ride.status === 'accepted' || ride.status === 'in_progress' || ride.status === 'completed') {
    const hasAccess = ride.clientId === senderId || ride.driverId === senderId

    // Si es el cliente, siempre puede chatear
    if (ride.clientId === senderId) {
      const message = new Message({ rideId, senderId, content })
      await message.save()

      broadcastToRide(rideId, {
        type: 'new_message',
        data: message
      })

      return c.json(message, 201)
    }

    // Si es el driver asignado, puede chatear
    if (ride.driverId === senderId) {
      const message = new Message({ rideId, senderId, content })
      await message.save()

      broadcastToRide(rideId, {
        type: 'new_message',
        data: message
      })

      return c.json(message, 201)
    }

    // Verificar si tiene un contact activo (driver que escribió antes de ser aceptado)
    const contact = await DriverContact.findOne({ driverId: senderId, rideId, isActive: true })
    if (contact) {
      const message = new Message({ rideId, senderId, content })
      await message.save()

      broadcastToRide(rideId, {
        type: 'new_message',
        data: message
      })

      return c.json(message, 201)
    }

    return c.json({ error: 'Forbidden: You do not have access to this ride' }, 403)
  }

  return c.json({ error: 'Chat is not available' }, 400)
})

// Proponer precio (driver)
messages.post('/propose-price', authMiddleware, async (c) => {
  const body = await c.req.json()
  const { rideId, proposedPrice } = body
  const currentUser = c.get('user')

  if (!currentUser || currentUser.role !== 'driver') {
    return c.json({ error: 'Only drivers can propose prices' }, 403)
  }

  const driverId = currentUser.clerkId

  // Obtener el ride
  if (!/^[0-9a-fA-F]{24}$/.test(rideId)) {
    return c.json({ error: 'Ride not found' }, 404)
  }
  const ride = await Ride.findById(rideId)
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }

  // Solo en estado 'requested'
  if (ride.status !== 'requested') {
    return c.json({ error: 'Can only propose price when ride is pending' }, 400)
  }

  // Validar precio
  if (!proposedPrice || proposedPrice <= 0) {
    return c.json({ error: 'Valid price required' }, 400)
  }

  // Buscar contact activo del driver
  const contact = await DriverContact.findOne({ driverId, rideId, isActive: true })
  if (!contact) {
    return c.json({ error: 'You must first send a message to the client' }, 403)
  }

  // Verificar que no haya alcanzado el máximo de propuestas
  if (contact.proposalCount >= MAX_PROPOSALS) {
    return c.json({
      error: 'Has alcanzado el máximo de 3 propuestas',
      proposalCount: contact.proposalCount
    }, 400)
  }

  // Actualizar propuesta
  contact.proposedPrice = proposedPrice
  contact.priceProposedAt = new Date()
  contact.proposalCount = contact.proposalCount + 1
  await contact.save()

  // Crear mensaje del sistema
  const message = new Message({
    rideId,
    senderId: driverId,
    content: `💰 Propuesta de precio: $${proposedPrice}`,
  })
  await message.save()

  // Emitir via WebSocket
  broadcastToRide(rideId, {
    type: 'price_proposed',
    data: {
      message,
      driverId,
      proposedPrice,
      proposalCount: contact.proposalCount,
      remainingProposals: MAX_PROPOSALS - contact.proposalCount
    }
  })

  return c.json({
    success: true,
    contact,
    proposalCount: contact.proposalCount,
    remainingProposals: MAX_PROPOSALS - contact.proposalCount
  })
})

// Aceptar precio (cliente)
messages.post('/accept-price', authMiddleware, async (c) => {
  const body = await c.req.json()
  const { rideId, driverId } = body
  const currentUser = c.get('user')

  if (!currentUser) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const clientId = currentUser.clerkId

  // Obtener el ride
  if (!/^[0-9a-fA-F]{24}$/.test(rideId)) {
    return c.json({ error: 'Ride not found' }, 404)
  }
  const ride = await Ride.findById(rideId)
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }

  // Solo el cliente puede aceptar
  if (ride.clientId !== clientId) {
    return c.json({ error: 'Only the client can accept a proposal' }, 403)
  }

  // Solo en estado 'requested'
  if (ride.status !== 'requested') {
    return c.json({ error: 'Can only accept price when ride is pending' }, 400)
  }

  // Buscar contact del driver que queremos aceptar
  const contact = await DriverContact.findOne({ driverId, rideId, isActive: true })
  if (!contact) {
    return c.json({ error: 'Driver has no active contact' }, 404)
  }

  if (!contact.proposedPrice) {
    return c.json({ error: 'Driver has not proposed a price yet' }, 400)
  }

  // Aceptar: cambiar ride a 'accepted'
  const updatedRide = await Ride.findByIdAndUpdate(
    { _id: rideId, status: 'requested' },
    { $set: { status: 'accepted', driverId, finalPrice: contact.proposedPrice, chatEnabled: true } },
    { new: true }
  )

  // Desactivar todos los otros contacts
  await DriverContact.updateMany(
    { rideId, driverId: { $ne: driverId } },
    { isActive: false }
  )

  // Crear mensaje del sistema
  const message = new Message({
    rideId,
    senderId: 'system',
    content: `✅ Precio aceptado: $${contact.proposedPrice}. ¡Contrato iniciado!`
  })
  await message.save()

  // Emitir cambio de estado
  broadcastToRide(rideId, {
    type: 'ride_status_changed',
    data: {
      rideId,
      previousStatus: 'requested',
      newStatus: 'accepted',
      ride: updatedRide,
      timestamp: new Date().toISOString(),
    },
  })

  // Emitir via WebSocket a todos
  broadcastToRide(rideId, {
    type: 'price_accepted',
    data: {
      message,
      driverId,
      finalPrice: contact.proposedPrice,
      ride: updatedRide
    }
  })

  return c.json({
    success: true,
    ride: updatedRide,
    message
  })
})

// Rechazar precio (cliente)
messages.post('/reject-price', authMiddleware, async (c) => {
  const body = await c.req.json()
  const { rideId, driverId } = body
  const currentUser = c.get('user')

  if (!currentUser) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const clientId = currentUser.clerkId

  // Obtener el ride
  if (!/^[0-9a-fA-F]{24}$/.test(rideId)) {
    return c.json({ error: 'Ride not found' }, 404)
  }
  const ride = await Ride.findById(rideId)
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }

  // Solo el cliente puede rechazar
  if (ride.clientId !== clientId) {
    return c.json({ error: 'Only the client can reject a proposal' }, 403)
  }

  // Solo en estado 'requested'
  if (ride.status !== 'requested') {
    return c.json({ error: 'Can only reject price when ride is pending' }, 400)
  }

  // Buscar contact del driver
  const contact = await DriverContact.findOne({ driverId, rideId, isActive: true })
  if (!contact) {
    return c.json({ error: 'Driver has no active contact' }, 404)
  }

  // Limpiar la propuesta (pero mantener el contact activo)
  contact.proposedPrice = undefined
  contact.priceProposedAt = undefined
  await contact.save()

  // Crear mensaje del sistema
  const message = new Message({
    rideId,
    senderId: 'system',
    content: `❌ Precio rechazado. El conductor puede enviar una nueva propuesta.`
  })
  await message.save()

  // Emitir via WebSocket
  broadcastToRide(rideId, {
    type: 'price_rejected',
    data: {
      message,
      driverId,
      canProposeMore: contact.proposalCount < MAX_PROPOSALS
    }
  })

  return c.json({
    success: true,
    canProposeMore: contact.proposalCount < MAX_PROPOSALS,
    proposalCount: contact.proposalCount
  })
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

// Obtener conteo de mensajes no leídos para un usuario
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