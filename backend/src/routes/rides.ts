import { Hono } from 'hono/tiny'
import { Ride } from '../models/ride'
import { Rating } from '../models/rating'
import { DriverContact } from '../models/driverContact'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'
import { createMarketplaceCharge, MarketplaceStripeError } from '../services/stripeMarketplace'

const rides = new Hono()

// Listar rides disponibles para driver (solo requested)
// Este endpoint es para que drivers puedan ver pedidos cercanos disponibles
rides.get('/available', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser

  // Solo drivers y admins pueden ver pedidos disponibles
  if (currentUser.role !== 'driver' && currentUser.role !== 'admin') {
    return c.json({ error: 'Solo conductors pueden ver pedidos disponibles' }, 403)
  }

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const type = c.req.query('type') // opcional: filtrar por tipo

  // Pedidos disponibles: solo requested
  const query: any = {
    status: 'requested'
  }
  
  // Filtrar por tipo si se especifica
  if (type) {
    query.type = type
  }
  
  const skip = (page - 1) * limit
  
  const [ridesList, total] = await Promise.all([
    Ride.find(query)
      .select('-chatEnabled') // No necesario para lista
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Ride.countDocuments(query)
  ])
  
  return c.json({
    data: ridesList,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  })
})

// Listar rides (con filtros) - requiere autenticación
rides.get('/', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const status = c.req.query('status')
  const clientId = c.req.query('clientId')
  const driverId = c.req.query('driverId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '10')
  
  const query: any = {}
  if (status) query.status = status

  // Ownership: clientes solo pueden ver sus propios pedidos
  if (currentUser.role === 'client') {
    query.clientId = currentUser.clerkId
  } else {
    if (clientId) query.clientId = clientId
    if (driverId) query.driverId = driverId
  }
  
  const skip = (page - 1) * limit
  
  const [ridesList, total] = await Promise.all([
    Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Ride.countDocuments(query)
  ])
  
  return c.json({
    data: ridesList,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  })
})

// Crear ride - requiere autenticación
rides.post('/', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const body = await c.req.json()
  
  // Validar campos requeridos
  const required = ['clientId', 'title', 'description', 'type', 'pickupLocation', 'dropoffLocation', 'estimatedPrice']
  const missing = required.filter(field => !body[field])
  
  if (missing.length > 0) {
    return c.json({ error: `Campos requeridos faltantes: ${missing.join(', ')}` }, 400)
  }

  // Validar máximo 8 imágenes (si se proporcionan)
  if (body.images && Array.isArray(body.images) && body.images.length > 8) {
    return c.json({ error: 'Máximo 8 imágenes permitidas' }, 400)
  }

  // Validar tipo válido
  const validTypes = ['mudanza', 'electrodomesticos', 'muebles', 'productos', 'otros']
  if (!validTypes.includes(body.type)) {
    return c.json({ error: `Tipo debe ser uno de: ${validTypes.join(', ')}` }, 400)
  }

  // Validar ubicaciones
  if (!body.pickupLocation.coordinates || !Array.isArray(body.pickupLocation.coordinates) || body.pickupLocation.coordinates.length !== 2) {
    return c.json({ error: 'pickupLocation.coordinates debe ser [lng, lat]' }, 400)
  }

  if (!body.dropoffLocation.coordinates || !Array.isArray(body.dropoffLocation.coordinates) || body.dropoffLocation.coordinates.length !== 2) {
    return c.json({ error: 'dropoffLocation.coordinates debe ser [lng, lat]' }, 400)
  }

  // Validar precio
  if (body.estimatedPrice < 0) {
    return c.json({ error: 'Precio no puede ser negativo' }, 400)
  }

  // Ownership: un cliente no puede crear rides para otro usuario
  if (currentUser.role === 'client' && body.clientId !== currentUser.clerkId) {
    return c.json({ error: 'No tienes permiso para crear pedidos para otro usuario' }, 403)
  }

  // Obtener payment method del usuario si no se proporciona en el body
  let stripePaymentMethodId = body.stripePaymentMethodId
  
  if (!stripePaymentMethodId) {
    // Buscar en el perfil del usuario
    const { User } = await import('../models/user')
    const userProfile = await User.findOne({ clerkId: currentUser.clerkId })
    if (userProfile?.stripePaymentMethodId) {
      stripePaymentMethodId = userProfile.stripePaymentMethodId
    }
  }
  
  if (!stripePaymentMethodId) {
    return c.json({ error: 'Debes guardar un método de pago primero. Ve a tu perfil y agrega una tarjeta.' }, 400)
  }

  try {
    const ride = new Ride({
      clientId: body.clientId,
      title: body.title,
      description: body.description,
      type: body.type,
      images: body.images,
      pickupLocation: {
        address: body.pickupLocation.address,
        type: 'Point',
        coordinates: body.pickupLocation.coordinates
      },
      dropoffLocation: {
        address: body.dropoffLocation.address,
        type: 'Point',
        coordinates: body.dropoffLocation.coordinates
      },
      estimatedPrice: body.estimatedPrice,
      packages: body.packages,
      notes: body.notes,
      stripePaymentMethodId, // Del body o del perfil del usuario
      status: 'requested',
      chatEnabled: false,
    })

    await ride.save()

    return c.json(ride, 201)
  } catch (error: any) {
    console.error('Error creating ride:', error)
    return c.json({ error: 'Error al crear el pedido: ' + error.message }, 500)
  }
})

// Obtener ride por ID - requiere autenticación
rides.get('/:id', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const id = c.req.param('id')
  const ride = await Ride.findById(id)

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  if (currentUser.role === 'client' && ride.clientId !== currentUser.clerkId) {
    return c.json({ error: 'No tienes permiso para ver este pedido' }, 403)
  }

  return c.json(ride)
})

// Obtener contacts (drivers que han iniciado chat) para un ride
rides.get('/:id/contacts', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const currentUser = (c as any).get('user') as AuthUser

  // Obtener el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  // Solo el cliente puede ver los contacts de su ride
  if (currentUser.role === 'client' && ride.clientId !== currentUser.clerkId) {
    return c.json({ error: 'No tienes permiso para ver los contactos de este pedido' }, 403)
  }

  // Obtener los contacts activos ordenados por fecha
  const contacts = await DriverContact.find({ rideId: id, isActive: true })
    .sort({ createdAt: 1 })

  // Obtener info de los drivers
  const { User } = await import('../models/user')
  const contactsWithDriverInfo = await Promise.all(
    contacts.map(async (contact) => {
      const driver = await User.findOne({ clerkId: contact.driverId })
      return {
        _id: contact._id,
        driverId: contact.driverId,
        createdAt: contact.createdAt,
        driver: driver ? {
          firstName: driver.firstName,
          lastName: driver.lastName,
          imageUrl: driver.imageUrl,
          email: driver.email
        } : null
      }
    })
  )

  return c.json({ data: contactsWithDriverInfo })
})

// Actualizar ride - requiere autenticación
rides.patch('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  // TODO: Verificar ownership del ride
  
  const ride = await Ride.findByIdAndUpdate(id, body, { new: true })
  
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  return c.json(ride)
})

// Cambiar estado del ride - requiere autenticación
rides.patch('/:id/status', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { status, reason } = await c.req.json()
  
  // Obtener el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  const update: any = { status }
  if (reason) update.cancellationReason = reason
  
  // LÓGICA: Si el estado cambia a 'completed', automáticamente cobrar
  if (status === 'completed' && !ride.paymentIntentId) {
    try {
      console.log(`💳 Cobrando automáticamente al completar ride ${id}...`)
      const chargeResult = await createMarketplaceCharge(id, { skipStatusCheck: true })
      update.paymentIntentId = chargeResult.paymentIntent.id
      update.platformFee = chargeResult.platformFee
      update.driverAmount = chargeResult.driverAmount
      update.paidAt = chargeResult.paymentIntent.status === 'succeeded' ? new Date() : undefined
      update.status = chargeResult.paymentIntent.status === 'succeeded' ? 'paid' : 'completed'
    } catch (err) {
      if (err instanceof MarketplaceStripeError) {
        console.warn(`ℹ️ Cobro automático omitido para ride ${id}: ${err.message}`)
      } else {
        console.error(`❌ Error intentando cobrar automáticamente:`, err)
      }
      // NO retornar error, dejar que el cliente intente pagar manualmente
      console.log(`ℹ️ Ride ${id} se completará, pero requiere pago manual`)
    }
  }

  const updatedRide = await Ride.findByIdAndUpdate(id, update, { new: true })
  
  return c.json(updatedRide)
})

// Aceptar ride (driver) - requiere autenticación
rides.post('/:id/accept', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { driverId, agreedPrice } = body
  
  const currentUser = (c as any).get('user') as AuthUser
  
  // Validar que el usuario es driver
  if (currentUser.role !== 'driver' && currentUser.role !== 'admin') {
    return c.json({ error: 'Solo conductors pueden aceptar pedidos' }, 403)
  }
  
  // Obtener el ride actual
  const existingRide = await Ride.findById(id)
  if (!existingRide) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  // Validar estado: solo puede aceptar si está en requested
  if (existingRide.status !== 'requested') {
    return c.json({
      error: 'No puedes aceptar este pedido en su estado actual',
      currentStatus: existingRide.status
    }, 400)
  }
  
  // Validar que el driver no acepte su propio pedido
  if (existingRide.clientId === driverId) {
    return c.json({ error: 'No puedes aceptar tu propio pedido' }, 400)
  }
  
  // Validar precio
  if (!agreedPrice || agreedPrice < 0) {
    return c.json({ error: 'Precio válido requerido' }, 400)
  }
  
  // Verificar que el ride aún está disponible (otro driver no lo aceptó)
  const ride = await Ride.findByIdAndUpdate(
    { _id: id, status: 'requested' },
    { $set: {
      driverId,
      status: 'accepted',
      chatEnabled: true,
      finalPrice: agreedPrice,
    }},
    { new: true }
  )

  if (!ride) {
    return c.json({ error: 'El pedido ya fue aceptado por otro conductor' }, 409)
  }

  // Desactivar todos los contacts excepto el del driver que aceptó
  await DriverContact.updateMany(
    { rideId: id, driverId: { $ne: driverId } },
    { isActive: false }
  )

  return c.json(ride)
})

// Iniciar viaje (driver confirma que tiene la mercancía cargada)
// Primero confirma carga, luego cambia a in_progress
rides.post('/:id/start', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const currentUser = (c as any).get('user') as AuthUser
  
  // Obtener el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  // Validar que el usuario es el driver asignado
  if (ride.driverId !== currentUser.clerkId && currentUser.role !== 'admin') {
    return c.json({ error: 'No tienes permiso para iniciar este viaje' }, 403)
  }
  
  // Solo puede iniciar si está en estado 'accepted'
  if (ride.status !== 'accepted') {
    return c.json({ 
      error: 'No puedes iniciar el viaje en este momento',
      currentStatus: ride.status,
      message: 'Solo puedes iniciar cuando el pedido esté aceptado'
    }, 400)
  }
  
  // Cambiar a in_progress
  const updatedRide = await Ride.findByIdAndUpdate(id, { status: 'in_progress' }, { new: true })
  
  return c.json({
    success: true,
    message: 'Viaje iniciado',
    ride: updatedRide
  })
})

// Subir foto de entrega (driver sube evidencia al llegar al destino)
rides.post('/:id/delivery-photo', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { url, publicId } = await c.req.json()
  const currentUser = (c as any).get('user') as AuthUser
  
  // Validar que hay url
  if (!url) {
    return c.json({ error: 'URL de imagen requerida' }, 400)
  }
  
  // Obtener el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  // Validar que el usuario es el driver asignado
  if (ride.driverId !== currentUser.clerkId && currentUser.role !== 'admin') {
    return c.json({ error: 'No tienes permiso para subir foto en este ride' }, 403)
  }
  
  // Solo puede subir foto si está en estado 'in_progress'
  if (ride.status !== 'in_progress') {
    return c.json({ 
      error: 'No puedes subir foto en este momento',
      currentStatus: ride.status,
      message: 'Solo puedes subir foto cuando el viaje está en progreso'
    }, 400)
  }
  
  const updatedRide = await Ride.findByIdAndUpdate(id, {
    deliveryPhoto: { url, publicId }
  }, { new: true })
  
  return c.json({
    success: true,
    message: 'Foto de entrega guardada',
    ride: updatedRide
  })
})

// Confirmar entrega (cliente verifica que recibió la mercancía)
rides.post('/:id/confirm-delivery', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const currentUser = (c as any).get('user') as AuthUser
  
  // Buscar el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  // Validar que el usuario es el cliente
  if (ride.clientId !== currentUser.clerkId && currentUser.role !== 'admin') {
    return c.json({ error: 'No tienes permiso para confirmar este ride' }, 403)
  }
  
  // Validar estado: solo se puede confirmar cuando está en progreso
  if (ride.status !== 'in_progress') {
    return c.json({ 
      error: 'No puedes confirmar la entrega en este momento',
      currentStatus: ride.status,
      message: 'Solo se puede confirmar cuando el ride está en estado "in_progress"'
    }, 400)
  }
  
  // Validar que hay foto de entrega
  if (!ride.deliveryPhoto) {
    return c.json({ error: 'El conductor debe subir una foto de entrega primero' }, 400)
  }
  
  // Cobro automático si hay método de pago guardado
  const update: any = { status: 'completed' }
  
  if (!ride.paymentIntentId) {
    try {
      console.log(`💳 Cobrando automáticamente al confirmar entrega ${id}...`)
      const chargeResult = await createMarketplaceCharge(id, { skipStatusCheck: true })
      update.paymentIntentId = chargeResult.paymentIntent.id
      update.platformFee = chargeResult.platformFee
      update.driverAmount = chargeResult.driverAmount
      update.paidAt = chargeResult.paymentIntent.status === 'succeeded' ? new Date() : undefined
      update.status = chargeResult.paymentIntent.status === 'succeeded' ? 'paid' : 'completed'
    } catch (err) {
      if (err instanceof MarketplaceStripeError) {
        console.warn(`ℹ️ Cobro automático omitido para ride ${id}: ${err.message}`)
      } else {
        console.error(`❌ Error intentando cobrar automáticamente:`, err)
      }
    }
  }
  
  const updatedRide = await Ride.findByIdAndUpdate(id, update, { new: true })
  
  return c.json({
    success: true,
    message: update.status === 'paid' ? 'Entrega confirmada y pago procesado' : 'Entrega confirmada',
    ride: updatedRide
  })
})

// Cancelar ride - requiere autenticación
rides.post('/:id/cancel', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const id = c.req.param('id')
  const { reason } = await c.req.json()

  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  // Reglas de AGENTS:
  // - requested: cliente puede cancelar
  // - accepted: solo conductor puede cancelar (solo si no ha iniciado viaje)
  // - in_progress/completed/paid: solo admin (caso excepcional)
  let canCancel = false

  if (currentUser.role === 'admin') {
    canCancel = true
  } else if (ride.status === 'requested') {
    canCancel = currentUser.clerkId === ride.clientId
  } else if (ride.status === 'accepted') {
    // Driver solo puede cancelar si no ha iniciado viaje
    canCancel = !!ride.driverId && currentUser.clerkId === ride.driverId
  }

  if (!canCancel) {
    return c.json({
      error: 'No tienes permiso para cancelar este pedido en su estado actual',
      currentStatus: ride.status,
    }, 403)
  }

  if (ride.status === 'in_progress' || ride.status === 'completed' || ride.status === 'paid') {
    return c.json({
      error: 'No se puede cancelar en este estado. Solo admin en casos excepcionales.',
      currentStatus: ride.status,
    }, 400)
  }
  
  const updatedRide = await Ride.findByIdAndUpdate(id, {
    status: 'cancelled',
    cancellationReason: reason || 'Cancelado por usuario'
  }, { new: true })
  
  return c.json(updatedRide)
})

// Calificar conductor (cliente) o cliente (conductor) - requiere autenticación
rides.post('/:id/rate', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { rating, comment, raterId } = await c.req.json()
  
  if (!raterId) {
    return c.json({ error: 'raterId es requerido' }, 400)
  }
  
  if (!rating || rating < 1 || rating > 5) {
    return c.json({ error: 'Calificación debe estar entre 1 y 5' }, 400)
  }
  
  // Obtener el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  // Determinar quién se está calificando
  let ratedId: string
  let role: 'client' | 'driver'
  
  if (raterId === ride.clientId && ride.driverId) {
    // Cliente califica al conductor
    ratedId = ride.driverId
    role = 'driver'
  } else if (raterId === ride.driverId && ride.clientId) {
    // Conductor califica al cliente
    ratedId = ride.clientId
    role = 'client'
  } else {
    return c.json({ error: 'No tienes permiso para calificar este ride' }, 403)
  }
  
  // Crear o actualizar la calificación
  const ratingRecord = await Rating.findOneAndUpdate(
    { rideId: id, raterId, ratedId, role },
    { rating, comment, createdAt: new Date() },
    { upsert: true, new: true }
  )

  // Si la calificación es para un driver, recalcular promedio y total
  if (role === 'driver') {
    try {
      const agg = await Rating.aggregate([
        { $match: { ratedId: ratedId, role: 'driver' } },
        { $group: { _id: '$ratedId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])

      if (agg && agg.length > 0) {
        const { avg, count } = agg[0]
        // Actualizar el Driver.rating y totalRides
        const { Driver } = await import('../models/driver')
        await Driver.findOneAndUpdate(
          { userId: ratedId },
          { rating: Number(avg.toFixed(2)), totalRides: count },
          { new: true }
        )
      }
    } catch (err) {
      console.error('Error actualizando promedio de driver:', err)
    }
  }

  return c.json(ratingRecord)
})

// Guardar método de pago en el ride - requiere autenticación
rides.post('/:id/payment-method', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { stripePaymentMethodId } = await c.req.json()
  
  if (!stripePaymentMethodId) {
    return c.json({ error: 'stripePaymentMethodId es requerido' }, 400)
  }
  
  const ride = await Ride.findByIdAndUpdate(
    id,
    { stripePaymentMethodId },
    { new: true }
  )
  
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  return c.json(ride)
})

export default rides