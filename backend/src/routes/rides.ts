import { Hono } from 'hono/tiny'
import { Ride } from '../models/ride'
import { Driver } from '../models/driver'
import { Offer } from '../models/offer'
import { DriverContact } from '../models/driverContact'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'
import { createMarketplaceCharge, MarketplaceStripeError, transferToDriver, refundPayment, createCharge } from '../services/stripeMarketplace'
import { broadcastToRide } from '../services/websocket'
import { canTransition, canCancel } from '../services/ride-machine'
import { logAudit } from '../services/audit'
import { 
  getDriverLocation,
  saveDriverAvailabilityLocation,
  addRidePickupLocation,
  removeRidePickupLocation,
  getNearbyRides,
} from '../services/redis'
import { createRatingAndUpdateAverage } from '../services/rating'
import { createNotification } from '../services/notificationService'

/**
 * Intenta realizar el cobro automático con el marketplace charge.
 * Modifica el objeto `update` in-place con paymentIntentId, platformFee, driverAmount, paidAt y status.
 * No lanza error — captura MarketplaceStripeError y loggea advirtiendo.
 */
async function processAutoCharge(rideId: string, update: Record<string, any>): Promise<void> {
  try {
    const chargeResult = await createMarketplaceCharge(rideId, { skipStatusCheck: true })
    update.paymentIntentId = chargeResult.paymentIntent.id
    update.platformFee = chargeResult.platformFee
    update.driverAmount = chargeResult.driverAmount
    update.paidAt = chargeResult.paymentIntent.status === 'succeeded' ? new Date() : undefined
    update.status = chargeResult.paymentIntent.status === 'succeeded' ? 'paid' : 'completed'
  } catch (err) {
    if (err instanceof MarketplaceStripeError) {
      console.warn(`Cobro automático omitido para ride ${rideId}: ${err.message}`)
    } else {
      console.error(`Error intentando cobrar automáticamente:`, err)
    }
  }
}

const rides = new Hono()

// Guardar ubicación de disponibilidad del conductor (para búsqueda por cercanía)
// El frontend llama esto cuando el driver abre el dashboard de rides disponibles.
// Se guarda en Redis con TTL 5 min, NO en MongoDB.
rides.post('/driver-location', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  
  if (currentUser.role !== 'driver' && currentUser.role !== 'admin') {
    return c.json({ error: 'Solo conductores pueden enviar ubicación' }, 403)
  }
  
  const { latitude, longitude } = await c.req.json()
  
  if (!latitude || !longitude) {
    return c.json({ error: 'latitude y longitude requeridos' }, 400)
  }
  
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return c.json({ error: 'latitude y longitude deben ser números' }, 400)
  }
  
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return c.json({ error: 'Coordenadas inválidas' }, 400)
  }
  
  const result = await saveDriverAvailabilityLocation(currentUser.clerkId, longitude, latitude)
  
  return c.json({
    success: result.success,
    message: result.success ? 'Ubicación guardada' : 'Error al guardar ubicación',
  })
})

// Listar rides disponibles para driver (solo requested)
// Soporta ordenamiento por cercanía si se envía lat/lng o si el driver tiene ubicación guardada
rides.get('/available', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser

  // Solo drivers y admins pueden ver pedidos disponibles
  if (currentUser.role !== 'driver' && currentUser.role !== 'admin') {
    return c.json({ error: 'Solo conductores pueden ver pedidos disponibles' }, 403)
  }

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const type = c.req.query('type')

  const skip = (page - 1) * limit

  // Pedidos disponibles: solo requested
  const query: any = { status: 'requested' }
  if (type) query.type = type

  // Determinar coordenadas para ordenamiento por cercanía:
  // 1. Query params (enviados por el frontend) tienen prioridad
  // 2. Fallback: ubicación guardada en MongoDB del driver
  let geoLng: number | null = null
  let geoLat: number | null = null

  const paramLat = parseFloat(c.req.query('lat') || '')
  const paramLng = parseFloat(c.req.query('lng') || '')

  if (!isNaN(paramLat) && !isNaN(paramLng)) {
    geoLat = paramLat
    geoLng = paramLng
  } else if (currentUser.role === 'driver') {
    // Fallback: buscar ubicación guardada del driver en MongoDB
    try {
      const driver = await Driver.findOne({ userId: currentUser.clerkId }).select('currentLocation').lean()
      if (driver?.currentLocation?.coordinates?.length === 2) {
        geoLng = driver.currentLocation.coordinates[0]
        geoLat = driver.currentLocation.coordinates[1]
      }
    } catch (err) {
      console.warn('Error reading driver location from MongoDB:', err)
    }
  }

  if (geoLng !== null && geoLat !== null) {
    // ── Ordenamiento por cercanía (Redis GEO) ──
    // Usamos un limit alto (999) para obtener TODOS los rides ordenados,
    // luego aplicamos paginación del lado del servidor
    const nearby = await getNearbyRides(geoLng, geoLat, 20000, 999)
    const rideIds = nearby.map(r => r.rideId)
    const distanceMap = new Map(nearby.map(r => [r.rideId, r.distance]))

    if (rideIds.length === 0) {
      return c.json({
        data: [],
        pagination: { page, limit, total: 0, pages: 0 },
      })
    }

    // Obtener rides de MongoDB
    const ridesDocs = await Ride.find({
      _id: { $in: rideIds },
      ...query,
    }).select('-chatEnabled').lean()

    const rideMap = new Map(ridesDocs.map(r => [r._id.toString(), r]))

    // Mantener el orden de Redis (ascendente por distancia) y paginar
    const sorted = rideIds
      .filter(id => rideMap.has(id))
      .slice(skip, skip + limit)
      .map(id => ({
        ...rideMap.get(id),
        distance: distanceMap.get(id),
      }))

    return c.json({
      data: sorted,
      pagination: {
        page,
        limit,
        total: rideIds.length,
        pages: Math.ceil(rideIds.length / limit),
      },
    })
  }

  // ── Sin coordenadas: ordenado por fecha (comportamiento original) ──
  const [ridesList, total] = await Promise.all([
    Ride.find(query)
      .select('-chatEnabled')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Ride.countDocuments(query),
  ])

  return c.json({
    data: ridesList,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
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

    // Fire-and-forget: registrar en Redis GEO para búsqueda por cercanía
    // Si Redis falla, el ride se crea igual (funcionalidad sin geo排序)
    addRidePickupLocation(
      ride._id.toString(),
      ride.pickupLocation.coordinates[0],
      ride.pickupLocation.coordinates[1],
    )

    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    await logAudit({
      action: 'ride.created',
      entityType: 'ride',
      entityId: ride._id.toString(),
      userId: currentUser?.clerkId || null,
      userRole: currentUser?.role,
      details: { title: ride.title },
      ip,
      userAgent,
    })

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
        proposedPrice: contact.proposedPrice,
        proposalCount: contact.proposalCount || 0,
        priceProposedAt: contact.priceProposedAt,
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
  const currentUser = (c as any).get('user') as AuthUser
  
  const ride = await Ride.findByIdAndUpdate(id, body, { new: true })
  
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  await logAudit({
    action: 'ride.updated',
    entityType: 'ride',
    entityId: id,
    userId: currentUser?.clerkId || null,
    userRole: currentUser?.role,
    ip,
    userAgent,
  })

  return c.json(ride)
})

// Cambiar estado del ride - requiere autenticación
rides.patch('/:id/status', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { status, reason } = await c.req.json()
  const currentUser = (c as any).get('user') as AuthUser
  
  // Obtener el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  const update: any = { status }
  if (reason) update.cancellationReason = reason
  
  // LÓGICA: Si el estado cambia a 'completed', automáticamente cobrar
  if (status === 'completed' && !ride.paymentIntentId) {
    await processAutoCharge(id, update)
  }

  const oldStatus = ride.status
  const updatedRide = await Ride.findByIdAndUpdate(id, update, { new: true })

  // Emitir via WebSocket
  broadcastToRide(id, {
    type: 'ride_status_changed',
    data: {
      rideId: id,
      previousStatus: oldStatus,
      newStatus: updatedRide.status,
      ride: updatedRide,
      timestamp: new Date().toISOString(),
    },
  })

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  await logAudit({
    action: 'ride.status_change',
    entityType: 'ride',
    entityId: id,
    userId: currentUser?.clerkId || null,
    userRole: currentUser?.role,
    details: { from: oldStatus, to: updatedRide.status },
    ip,
    userAgent,
  })

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
  
  // Validar estado usando la máquina de estados centralizada
  const transitionCheck = canTransition(existingRide.status, 'accepted', currentUser.role)
  if (!transitionCheck.allowed) {
    return c.json({
      error: transitionCheck.reason || 'No puedes aceptar este pedido en su estado actual',
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

  // Limpiar de Redis GEO (ya no está disponible para otros drivers)
  removeRidePickupLocation(id)

  // Desactivar todos los contacts excepto el del driver que aceptó
  await DriverContact.updateMany(
    { rideId: id, driverId: { $ne: driverId } },
    { isActive: false }
  )

  // NEW: Capture payment immediately when driver accepts (transfer happens at confirm-delivery)
  // If payment fails (insufficient funds), revert the acceptance
  if (!ride.paymentIntentId) {
    try {
      const chargeResult = await createCharge(ride._id.toString())
      
      // Refresh ride with payment info
      const updatedRide = await Ride.findById(ride._id)
      if (updatedRide) {
        Object.assign(ride, updatedRide)
      }
    } catch (chargeError: any) {
      // Revert: remove driver assignment and set status back
      console.error(`Error capturing payment for ride ${ride._id}: ${chargeError.message}`)
      
      await Ride.findByIdAndUpdate(ride._id, {
        driverId: undefined,
        status: 'requested',
        chatEnabled: false,
        finalPrice: undefined,
      })

      // Re-agregar a Redis GEO porque el ride volvió a requested
      const revertedRide = await Ride.findById(ride._id)
      if (revertedRide) {
        addRidePickupLocation(
          revertedRide._id.toString(),
          revertedRide.pickupLocation.coordinates[0],
          revertedRide.pickupLocation.coordinates[1],
        )
      }
      
      return c.json({
        error: 'No se pudo procesar el pago. Fondos insuficientes o método de pago inválido.',
        details: chargeError.message,
        currentStatus: 'requested'
      }, 402)
    }
  }

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  await logAudit({
    action: 'ride.accepted',
    entityType: 'ride',
    entityId: id,
    userId: currentUser?.clerkId || null,
    userRole: currentUser?.role,
    details: { driverId: currentUser?.clerkId },
    ip,
    userAgent,
  })

  // Emitir via WebSocket
  broadcastToRide(id, {
    type: 'ride_status_changed',
    data: {
      rideId: id,
      previousStatus: 'requested',
      newStatus: 'accepted',
      ride,
      timestamp: new Date().toISOString(),
    },
  })

  // Notify client that a driver accepted their ride
  createNotification(
    ride.clientId,
    'ride_status',
    'Conductor asignado',
    `Un conductor acepto tu pedido "${ride.title}"`,
    `/ride/${ride._id}`,
    { rideId: ride._id.toString() }
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
  
  // Validar estado usando la máquina de estados centralizada
  const transitionCheck = canTransition(ride.status, 'in_progress', currentUser.role)
  if (!transitionCheck.allowed) {
    return c.json({ 
      error: transitionCheck.reason || 'No puedes iniciar el viaje en este momento',
      currentStatus: ride.status,
    }, 400)
  }
  
  // Cambiar a in_progress
  const updatedRide = await Ride.findByIdAndUpdate(id, { status: 'in_progress' }, { new: true })

  // Emitir via WebSocket
  broadcastToRide(id, {
    type: 'ride_status_changed',
    data: {
      rideId: id,
      previousStatus: 'accepted',
      newStatus: 'in_progress',
      ride: updatedRide,
      timestamp: new Date().toISOString(),
    },
  })

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  await logAudit({
    action: 'ride.started',
    entityType: 'ride',
    entityId: id,
    userId: currentUser?.clerkId || null,
    userRole: currentUser?.role,
    ip,
    userAgent,
  })

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

  // Notify client via email that delivery photo was uploaded
  if (updatedRide) {
    const { sendEmail, getUserEmail, deliveryPhotoUploadedEmail } = await import('../services/notifications/email')
    const clientEmail = await getUserEmail(updatedRide.clientId)
    if (clientEmail) {
      const emailContent = deliveryPhotoUploadedEmail(clientEmail, {
        rideId: updatedRide._id.toString(),
        title: updatedRide.title,
        pickupAddress: updatedRide.pickupLocation.address,
        dropoffAddress: updatedRide.dropoffLocation.address,
      })
      sendEmail(emailContent) // Fire-and-forget
    }
  }

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  await logAudit({
    action: 'ride.delivery_photo',
    entityType: 'ride',
    entityId: id,
    userId: currentUser?.clerkId || null,
    userRole: currentUser?.role,
    ip,
    userAgent,
  })

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
  
  // Validar estado usando la máquina de estados centralizada
  const transitionCheck = canTransition(ride.status, 'completed', currentUser.role)
  if (!transitionCheck.allowed) {
    return c.json({ 
      error: transitionCheck.reason || 'No puedes confirmar la entrega en este momento',
      currentStatus: ride.status,
    }, 400)
  }
  
  // Validar que hay foto de entrega
  if (!ride.deliveryPhoto) {
    return c.json({ error: 'El conductor debe subir una foto de entrega primero' }, 400)
  }
  
  // Payment already captured on accept - just do the transfer to driver
  let update: any = { status: 'paid' }

  if (ride.paymentIntentId && !ride.transferId) {
    // Get driver Stripe account
    const { Driver } = await import('../models/driver')
    const driver = await Driver.findOne({ userId: ride.driverId })
    if (!driver?.stripeAccountId) {
      return c.json({ error: 'Driver has no Stripe account configured' }, 400)
    }

    // Transfer to driver (90%)
    const amountInCents = ride.driverAmount || Math.round((ride.finalPrice || ride.estimatedPrice) * 90)
    const transfer = await transferToDriver(driver.stripeAccountId, amountInCents, ride._id.toString())

    // Update ride with payment info
    update = {
      status: 'paid',
      transferId: transfer.id,
      transferredAt: new Date(),
      paidAt: new Date(),
    }
  } else if (ride.paymentIntentId && ride.transferId) {
    // Already transferred - just update status to paid (idempotency)
    update = {
      status: 'paid',
    }
  } else {
    // Fallback: old behavior via processAutoCharge (edge case for old rides without paymentIntentId)
    await processAutoCharge(id, update)
  }
  
  const updatedRide = await Ride.findByIdAndUpdate(id, update, { new: true })

  // Emitir via WebSocket
  broadcastToRide(id, {
    type: 'ride_status_changed',
    data: {
      rideId: id,
      previousStatus: 'in_progress',
      newStatus: updatedRide.status,
      ride: updatedRide,
      timestamp: new Date().toISOString(),
    },
  })

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  await logAudit({
    action: 'ride.delivery_confirmed',
    entityType: 'ride',
    entityId: id,
    userId: currentUser?.clerkId || null,
    userRole: currentUser?.role,
    details: { status: 'completed' },
    ip,
    userAgent,
  })

  // ── Enviar factura por email después del pago ──
  if (updatedRide?.status === 'paid') {
    try {
      const { generateInvoicePDF } = await import('../services/invoice')
      const { sendEmail } = await import('../services/notifications/email')
      const { User } = await import('../models/user')

      const pdfBuffer = await generateInvoicePDF(updatedRide)

      // Send to client
      const clientUser = await User.findOne({ clerkId: updatedRide.clientId })
      if (clientUser?.email) {
        await sendEmail({
          to: clientUser.email,
          subject: `Factura Carglyn - ${updatedRide.title}`,
          html: `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); color: white; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">✅ ¡Pago Confirmado!</h1>
                <p style="margin: 8px 0 0; opacity: 0.9;">Gracias por usar Carglyn</p>
              </div>
              <div style="padding: 32px 24px; background: #F8FAFC;">
                <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px;">Hola,</p>
                <p style="margin: 0 0 24px; color: #334155; font-size: 16px; line-height: 1.6;">
                  Tu pago por el acarreo <strong>"${updatedRide.title}"</strong> ha sido procesado exitosamente.
                </p>
                <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
                  <p style="margin: 8px 0; color: #334155; font-size: 14px;"><strong>Monto pagado:</strong> $${(updatedRide.finalPrice || updatedRide.estimatedPrice).toFixed(2)}</p>
                  <p style="margin: 8px 0; color: #334155; font-size: 14px;"><strong>Recogida:</strong> ${updatedRide.pickupLocation.address}</p>
                  <p style="margin: 8px 0; color: #334155; font-size: 14px;"><strong>Entrega:</strong> ${updatedRide.dropoffLocation.address}</p>
                </div>
                <p style="margin: 0 0 24px; color: #334155; font-size: 16px;">Encuentra tu factura adjunta en este correo y también disponible para descargar en la aplicación.</p>
                <div style="text-align: center; margin-top: 24px;">
                  <a href="${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${updatedRide._id}" style="display: inline-block; background: #0D9488; color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Ver Detalles del Acarreo
                  </a>
                </div>
              </div>
              <div style="padding: 24px; text-align: center; color: #64748B; font-size: 14px; border-top: 1px solid #E2E8F0;">
                <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
              </div>
            </div>
          `,
        })
        console.log(`[Email] Invoice sent to client: ${clientUser.email} for ride: ${updatedRide._id}`)
      }

      // Also send to driver
      if (updatedRide.driverId) {
        const driverUser = await User.findOne({ clerkId: updatedRide.driverId })
        if (driverUser?.email) {
          await sendEmail({
            to: driverUser.email,
            subject: `Resumen de pago Carglyn - ${updatedRide.title}`,
            html: `
              <div style="font-family: 'Plus Jakarta Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <div style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); color: white; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 24px;">✅ ¡Pago Recibido!</h1>
                  <p style="margin: 8px 0 0; opacity: 0.9;">Transferencia completada a tu cuenta</p>
                </div>
                <div style="padding: 32px 24px; background: #F8FAFC;">
                  <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px;">Hola,</p>
                  <p style="margin: 0 0 24px; color: #334155; font-size: 16px; line-height: 1.6;">
                    El pago por el acarreo <strong>"${updatedRide.title}"</strong> ha sido transferido a tu cuenta Stripe Connect.
                  </p>
                  <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
                    <p style="margin: 0 0 16px; color: #64748B; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Monto recibido</p>
                    <p style="margin: 0; color: #22C55E; font-size: 32px; font-weight: 700;">$${(updatedRide.driverAmount || (updatedRide.finalPrice || updatedRide.estimatedPrice) * 0.9).toFixed(2)}</p>
                    <p style="margin: 8px 0 0; color: #64748B; font-size: 12px;">(Total: $${(updatedRide.finalPrice || updatedRide.estimatedPrice).toFixed(2)} - Comisión 10%)</p>
                  </div>
                </div>
                <div style="padding: 24px; text-align: center; color: #64748B; font-size: 14px; border-top: 1px solid #E2E8F0;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
                </div>
              </div>
            `,
          })
          console.log(`[Email] Payment summary sent to driver: ${driverUser.email} for ride: ${updatedRide._id}`)
        }
      }
    } catch (emailErr) {
      console.error(`[Email] Failed to send invoice email for ride ${updatedRide._id}:`, emailErr)
    }
  }

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

  // Ownership checks
  if (currentUser.role === 'client' && ride.clientId !== currentUser.clerkId) {
    return c.json({ error: 'No tienes permiso para cancelar este pedido' }, 403)
  }
  if (currentUser.role === 'driver' && ride.driverId !== currentUser.clerkId) {
    return c.json({ error: 'No tienes permiso para cancelar este pedido' }, 403)
  }

  const oldStatus = ride.status
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''

  // --- DRIVER UNASSIGN: solo en accepted, vuelve a requested sin refund ---
  if (currentUser.role === 'driver' && ride.status === 'accepted') {
    const updatedRide = await Ride.findByIdAndUpdate(id, {
      $set: {
        status: 'requested',
        chatEnabled: false,
        updatedAt: new Date(),
      },
      $unset: {
        driverId: '',
        finalPrice: '',
      }
    }, { new: true })

    // Marcar la oferta aceptada del driver como cancelada
    await Offer.updateOne(
      { rideId: id, driverId: currentUser.clerkId, status: 'accepted' },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    )

    // Re-agregar a Redis GEO porque el ride volvió a requested
    addRidePickupLocation(id, ride.pickupLocation.coordinates[0], ride.pickupLocation.coordinates[1])

    broadcastToRide(id, {
      type: 'ride_status_changed',
      data: {
        rideId: id,
        previousStatus: oldStatus,
        newStatus: 'requested',
        ride: updatedRide,
        timestamp: new Date().toISOString(),
      },
    })

    await logAudit({
      action: 'ride.cancelled',
      entityType: 'ride',
      entityId: id,
      userId: currentUser?.clerkId || null,
      userRole: currentUser?.role,
      details: { reason: reason || 'Conductor se retiró', type: 'driver_unassign' },
      ip,
      userAgent,
    })

    return c.json(updatedRide)
  }

  // --- CLIENT CANCEL (o admin): con refund automático si hay pago ---
  const hasPaymentIntent = !!(ride.paymentIntentId && !ride.transferId)
  const cancelCheck = canCancel(ride.status, currentUser.role, hasPaymentIntent)
  if (!cancelCheck.allowed) {
    return c.json({
      error: cancelCheck.reason,
      currentStatus: ride.status,
    }, 403)
  }

  const role = currentUser.role

  // Build base update
  const updateBase: any = {
    status: 'cancelled',
    cancellationReason: reason || 'Cancelado por usuario',
  }

  // Automatic refund if ride was charged but not yet transferred
  if (ride.paymentIntentId && !ride.transferId) {
    // Ride was charged but not transferred → refund the client
    const refundResult = await refundPayment(
      ride.paymentIntentId,
      'Cancellation by ' + role
    )

    updateBase.refundId = refundResult.id
    updateBase.refundedAt = new Date()
    updateBase.refundReason = 'Cancellation by ' + role
  } else if (ride.paymentIntentId && ride.transferId) {
    // Already transferred → cannot cancel (admin only via disputes)
    return c.json({
      error: 'Cannot cancel: payment already transferred. Contact support.',
      currentStatus: ride.status,
    }, 400)
  }

  const updatedRide = await Ride.findByIdAndUpdate(id, updateBase, { new: true })

  // Limpiar de Redis GEO (ride cancelado definitivamente)
  removeRidePickupLocation(id)

  // Emitir via WebSocket
  broadcastToRide(id, {
    type: 'ride_status_changed',
    data: {
      rideId: id,
      previousStatus: oldStatus,
      newStatus: 'cancelled',
      ride: updatedRide,
      timestamp: new Date().toISOString(),
    },
  })

  await logAudit({
    action: 'ride.cancelled',
    entityType: 'ride',
    entityId: id,
    userId: currentUser?.clerkId || null,
    userRole: currentUser?.role,
    details: { reason: reason || 'No especificado' },
    ip,
    userAgent,
  })

  return c.json(updatedRide)  
})

// Obtener ubicación actual del conductor (tracking en vivo)
// Expone la ubicación guardada en Redis para que el cliente la obtenga al cargar la página
rides.get('/:id/driver-location', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const currentUser = (c as any).get('user') as AuthUser

  // Verificar que el ride existe
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  // Solo participantes o admin pueden ver la ubicación
  const isParticipant = ride.clientId === currentUser.clerkId || ride.driverId === currentUser.clerkId
  if (!isParticipant && currentUser.role !== 'admin') {
    return c.json({ error: 'No tienes permiso para ver este ride' }, 403)
  }

  // Obtener ubicación desde Redis
  const location = await getDriverLocation(id)
  return c.json({ data: location })
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
  
  // Usar el servicio centralizado de calificaciones
  let ratingRecord
  try {
    ratingRecord = await createRatingAndUpdateAverage(
      id, raterId, ratedId, role, rating, comment,
    )
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('Ya has calificado')) {
      return c.json({ error: message }, 409)
    }
    throw err
  }

  // Emitir via WebSocket — notificar al conductor sobre nueva calificación
  if (role === 'driver') {
    try {
      const { Driver } = await import('../models/driver')
      const driverData = await Driver.findOne({ userId: ratedId }).select('rating totalRides')

      // Broadcast a la sala del ride (para quien esté viendo el detalle/chat)
      broadcastToRide(id, {
        type: 'rating_updated',
        data: {
          rideId: id,
          ratedId,
          rating: driverData?.rating,
          totalRides: driverData?.totalRides,
          role,
        },
      })

      // Broadcast directamente al conductor (para el driver dashboard en vivo)
      const { broadcastToUser } = await import('../services/websocket')
      broadcastToUser(ratedId, {
        type: 'rating_updated',
        data: {
          rideId: id,
          rating: driverData?.rating,
          totalRides: driverData?.totalRides,
        },
      })
    } catch (err) {
      console.error('Error broadcasting rating update:', err)
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

// Generar/descargar factura PDF (solo disponible si status === 'paid')
rides.get('/:id/invoice', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const currentUser = c.get('user') as AuthUser

    const ride = await Ride.findById(id)
    if (!ride) {
      return c.json({ error: 'Ride no encontrado' }, 404)
    }

    // Solo participantes (cliente o conductor) pueden ver la factura
    const isParticipant = ride.clientId === currentUser.clerkId || ride.driverId === currentUser.clerkId
    if (!isParticipant && currentUser.role !== 'admin') {
      return c.json({ error: 'No tienes permiso para ver esta factura' }, 403)
    }

    // Solo disponible si el ride está pagado
    if (ride.status !== 'paid') {
      return c.json({ error: 'La factura solo está disponible después del pago' }, 400)
    }

    // Generate invoice PDF (lazy import so it doesn't break if pdfkit isn't installed)
    const { generateInvoicePDF } = await import('../services/invoice')
    const pdfBuffer = await generateInvoicePDF(ride)

    // Return PDF
    c.header('Content-Type', 'application/pdf')
    c.header('Content-Disposition', `attachment; filename="factura-${ride._id.toString().slice(-8)}.pdf"`)
    c.header('Content-Length', pdfBuffer.length.toString())

    return c.body(pdfBuffer)
  } catch (error: any) {
    console.error('Error generating invoice:', error)
    return c.json({ error: 'Error generando la factura' }, 500)
  }
})

export default rides