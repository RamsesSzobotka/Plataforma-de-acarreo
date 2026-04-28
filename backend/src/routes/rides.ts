import { Hono } from 'hono/tiny'
import { Ride } from '../models/ride'
import { Driver } from '../models/driver'
import { User } from '../models/user'
import { authMiddleware } from '../middleware/auth'
import { roleMiddleware } from '../middleware/role'
import { ownershipMiddleware } from '../middleware/ownership'
import { verifyDriverMiddleware } from '../middleware/verify-driver'
import { calculateDistanceToGeoJSON } from '../utils/haversine'
import {
  createRideSchema,
  updateRideSchema,
  acceptRideSchema,
  updateStatusSchema,
  cancelRideSchema,
  deliveryPhotoSchema
} from '../schemas/ride'
import {
  isValidTransition,
  getTransitionRejectionReason,
  isRideEditable,
  isRideCancelable
} from '../utils/rideStateMachine'

const rides = new Hono()

/**
 * GET /api/rides - Listar rides
 * 
 * Soporta dos modos:
 * 1. Geospatial (para drivers): lat, lng, radius → retorna rides ordenados por distancia
 * 2. Filtrado simple: status, clientId, driverId con paginación estándar
 */
rides.get('/', async (c) => {
  const lat = c.req.query('lat')
  const lng = c.req.query('lng')
  
  // MODE 1: Geospatial filtering (if lat/lng provided)
  if (lat && lng) {
    const radius = c.req.query('radius') || '25'
    const limit = parseInt(c.req.query('limit') || '20')
    const skip = parseInt(c.req.query('skip') || '0')
    const status = c.req.query('status') || 'requested,negotiating'

    // Validate coordinates
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return c.json({ error: 'Invalid coordinates provided' }, 400)
    }

    if (latNum < -90 || latNum > 90) {
      return c.json({ error: 'lat must be between -90 and 90' }, 400)
    }

    if (lngNum < -180 || lngNum > 180) {
      return c.json({ error: 'lng must be between -180 and 180' }, 400)
    }

    // Validate radius
    const validRadii = [5, 10, 25, 50]
    const radiusNum = parseInt(radius)
    if (!validRadii.includes(radiusNum)) {
      return c.json({ error: 'radius must be one of: 5, 10, 25, 50' }, 400)
    }

    // Parse status filter
    const statuses = status.split(',').map((s) => s.trim())

    try {
      // Query rides using 2dsphere
      const rides_docs = await Ride.find({
        status: { $in: statuses },
        'pickupLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lngNum, latNum],
            },
            $maxDistance: radiusNum * 1000,
          },
        },
      })
        .limit(limit)
        .skip(skip)

      // Calculate distance for each ride
      const ridesWithDistance = rides_docs.map((ride) => {
        const distance = calculateDistanceToGeoJSON(
          latNum,
          lngNum,
          ride.pickupLocation.coordinates.coordinates as [number, number],
        )
        return {
          ...ride.toObject(),
          distance,
        }
      })

      const total = await Ride.countDocuments({
        status: { $in: statuses },
        'pickupLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lngNum, latNum],
            },
            $maxDistance: radiusNum * 1000,
          },
        },
      })

      return c.json({
        success: true,
        data: ridesWithDistance,
        pagination: {
          total,
          limit,
          skip,
          hasMore: skip + limit < total,
        },
        metadata: {
          searchedAt: new Date().toISOString(),
          driverLocation: { lat: latNum, lng: lngNum },
          radiusKm: radiusNum,
        },
      })
    } catch (err) {
      console.error('Geospatial query error:', err)
      return c.json({ error: 'Failed to query nearby rides' }, 500)
    }
  }

  // MODE 2: Simple filtering with pagination
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100)
  
  if (page < 1) {
    return c.json({ error: 'Page must be greater than 0' }, 400)
  }

  const query: any = {}
  const statusParam = c.req.query('status')
  const clientIdParam = c.req.query('clientId')
  const driverIdParam = c.req.query('driverId')

  if (statusParam) query.status = statusParam
  if (clientIdParam) query.clientId = clientIdParam
  if (driverIdParam) query.driverId = driverIdParam

  try {
    const skip = (page - 1) * limit
    const [ridesList, total] = await Promise.all([
      Ride.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Ride.countDocuments(query)
    ])

    return c.json({
      success: true,
      data: ridesList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    })
  } catch (err) {
    console.error('Ride list query error:', err)
    return c.json({ error: 'Failed to fetch rides' }, 500)
  }
})

/**
 * GET /api/rides/:id - Obtener detalle completo del ride
 */
rides.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const ride = await Ride.findById(id)

    if (!ride) {
      return c.json({ error: 'Ride no encontrado' }, 404)
    }

    // Get client profile
    const clientUser = await User.findOne({ clerkId: ride.clientId })

    // Calculate distance if driver location provided
    let distance: number | undefined
    const driverLat = c.req.query('driverLat')
    const driverLng = c.req.query('driverLng')
    
    if (driverLat && driverLng) {
      const driverLatNum = parseFloat(driverLat)
      const driverLngNum = parseFloat(driverLng)

      if (Number.isFinite(driverLatNum) && Number.isFinite(driverLngNum)) {
        distance = calculateDistanceToGeoJSON(
          driverLatNum,
          driverLngNum,
          ride.pickupLocation.coordinates.coordinates as [number, number],
        )
      }
    }

    return c.json({
      success: true,
      ride: ride.toObject(),
      distance,
      client: clientUser
        ? {
            clerkId: clientUser.clerkId,
            firstName: clientUser.firstName,
            lastName: clientUser.lastName,
            imageUrl: clientUser.imageUrl,
            email: clientUser.email,
          }
        : null,
    })
  } catch (err) {
    console.error('Error obteniendo ride:', err)
    return c.json({ error: 'Error al obtener el ride' }, 500)
  }
})

/**
 * POST /api/rides - Crear nuevo ride (cliente)
 */
rides.post('/', authMiddleware, roleMiddleware('client'), async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()

    // Validate with Zod
    const result = createRideSchema.safeParse(body)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      return c.json(
        { error: 'Validación fallida', details: errors },
        400,
      )
    }

    const ride = new Ride({
      ...result.data,
      clientId: user.clerkId,
      status: 'requested',
      chatEnabled: false,
    })

    await ride.save()

    return c.json({
      success: true,
      ride: ride.toObject(),
    }, 201)
  } catch (err) {
    console.error('Create ride error:', err)
    return c.json({ error: 'Error al crear el ride' }, 500)
  }
})

/**
 * POST /api/rides/:id/accept - Aceptar ride (driver)
 */
rides.post(
  '/:id/accept',
  authMiddleware,
  roleMiddleware('driver'),
  verifyDriverMiddleware,
  async (c) => {
    try {
      const id = c.req.param('id')
      const user = c.get('user')
      const body = await c.req.json()

      // Validate with Zod
      const result = acceptRideSchema.safeParse(body)
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors
        return c.json(
          { error: 'Validación fallida', details: errors },
          400,
        )
      }

      const { agreedPrice } = result.data

      // Fetch ride
      const ride = await Ride.findById(id)

      if (!ride) {
        return c.json({ error: 'Ride no encontrado' }, 404)
      }

      // Validate ride is available
      if (ride.driverId) {
        return c.json(
          { error: 'Ride already accepted by another driver' },
          400,
        )
      }

      // Validate ride status allows accept
      if (!['requested', 'negotiating'].includes(ride.status)) {
        return c.json(
          {
            error: `Ride cannot be accepted in status: ${ride.status}`,
          },
          400,
        )
      }

      // Validate transition with state machine
      if (!isValidTransition(ride.status, 'accepted', user.role)) {
        const message = getTransitionRejectionReason(ride.status, 'accepted', user.role)
        return c.json({ error: message }, 400)
      }

      // Update ride
      ride.driverId = user.clerkId
      ride.status = 'accepted'
      ride.finalPrice = agreedPrice || ride.estimatedPrice
      ride.chatEnabled = true
      ride.updatedAt = new Date()

      await ride.save()

      // Add warning to response if bypass was used
      const warning = c.get('verificationWarning')

      return c.json({
        success: true,
        ride: ride.toObject(),
        message: 'Ride accepted successfully. Chat is now active.',
        ...(warning && { verificationWarning: warning }),
      })
    } catch (err) {
      console.error('Accept ride error:', err)
      return c.json({ error: 'Error al aceptar el ride' }, 500)
    }
  },
)

/**
 * POST /api/rides/:id/cancel - Cancelar ride
 */
rides.post(
  '/:id/cancel',
  authMiddleware,
  async (c) => {
    try {
      const id = c.req.param('id')
      const user = c.get('user')
      const body = await c.req.json()

      const ride = await Ride.findById(id)
      if (!ride) {
        return c.json({ error: 'Ride no encontrado' }, 404)
      }

      // Validate with Zod
      const result = cancelRideSchema.safeParse(body)
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors
        return c.json(
          { error: 'Validación fallida', details: errors },
          400,
        )
      }

      // Validate ride can be cancelled
      if (!isRideCancelable(ride.status, user.role)) {
        const message = getTransitionRejectionReason(ride.status, 'cancelled', user.role)
        return c.json({ error: message }, 400)
      }

      // Verify user is the owner
      const isClient = ride.clientId === user.clerkId
      const isDriver = ride.driverId === user.clerkId
      
      if (!isClient && !isDriver) {
        return c.json(
          { error: 'You are not involved in this ride' },
          403,
        )
      }

      const updated = await Ride.findByIdAndUpdate(
        id,
        {
          status: 'cancelled',
          cancellationReason: result.data.cancellationReason,
          updatedAt: new Date(),
        },
        { new: true },
      )

      return c.json({
        success: true,
        ride: updated,
        message: 'Ride cancelled successfully',
      })
    } catch (err) {
      console.error('Cancel ride error:', err)
      return c.json({ error: 'Error al cancelar el ride' }, 500)
    }
  },
)

/**
 * GET /api/rides/user/me - Mis rides (requiere auth)
 */
rides.get('/user/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100)
    const status = c.req.query('status')

    const query: any = {}
    
    // Cliente ve sus pedidos, driver ve sus acarreos
    if (user.role === 'client') {
      query.clientId = user.clerkId
    } else if (user.role === 'driver') {
      query.driverId = user.clerkId
    }
    
    if (status) query.status = status

    const skip = (page - 1) * limit
    
    const [ridesList, total] = await Promise.all([
      Ride.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Ride.countDocuments(query)
    ])
    
    return c.json({
      success: true,
      data: ridesList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      }
    })
  } catch (err) {
    console.error('Error en /user/me:', err)
    return c.json({ error: 'Error al obtener tus rides' }, 500)
  }
})

/**
 * PATCH /api/rides/:id - Actualizar ride (solo requested/negotiating)
 */
rides.patch('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    
    const ride = await Ride.findById(id)
    if (!ride) {
      return c.json({ error: 'Ride no encontrado' }, 404)
    }
    
    // Solo el cliente puede editar
    if (ride.clientId !== user.clerkId) {
      return c.json({ error: 'No tienes permiso para editar este ride' }, 403)
    }
    
    // Solo se puede editar en estado 'requested' o 'negotiating'
    if (!isRideEditable(ride.status)) {
      return c.json(
        { error: `No puedes editar un ride en estado ${ride.status}` },
        400
      )
    }
    
    // Validar con Zod
    const result = updateRideSchema.safeParse(body)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      return c.json(
        { error: 'Validación fallida', details: errors },
        400
      )
    }
    
    // No permitir cambiar clientId
    if ('clientId' in result.data) {
      return c.json({ error: 'No puedes cambiar el propietario del ride' }, 400)
    }
    
    const updated = await Ride.findByIdAndUpdate(
      id,
      {
        ...result.data,
        updatedAt: new Date()
      },
      { new: true }
    )
    
    return c.json({
      success: true,
      ride: updated,
    })
  } catch (err) {
    console.error('Error actualizando ride:', err)
    return c.json({ error: 'Error al actualizar el ride' }, 500)
  }
})

/**
 * POST /api/rides/:id/start - Confirmar carga e iniciar viaje (driver)
 */
rides.post('/:id/start', authMiddleware, roleMiddleware('driver'), async (c) => {
  try {
    const id = c.req.param('id')
    const user = c.get('user')
    const ride = await Ride.findById(id)
    
    if (!ride) {
      return c.json({ error: 'Ride no encontrado' }, 404)
    }
    
    // Validar que es el driver asignado
    if (ride.driverId !== user.clerkId) {
      return c.json({ error: 'No eres el conductor de este ride' }, 403)
    }
    
    // Validar que está en estado 'accepted'
    if (ride.status !== 'accepted') {
      return c.json(
        { error: `Solo puedes iniciar viajes en estado 'accepted', este está en '${ride.status}'` },
        400
      )
    }
    
    const updated = await Ride.findByIdAndUpdate(
      id,
      {
        status: 'in_progress',
        updatedAt: new Date()
      },
      { new: true }
    )
    
    return c.json({
      success: true,
      ride: updated,
      message: 'Viaje iniciado. Comparte tu ubicación.',
    })
  } catch (err) {
    console.error('Error iniciando viaje:', err)
    return c.json({ error: 'Error al iniciar el viaje' }, 500)
  }
})

/**
 * POST /api/rides/:id/delivery-photo - Subir foto de entrega (driver)
 */
rides.post('/:id/delivery-photo', authMiddleware, roleMiddleware('driver'), async (c) => {
  try {
    const id = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    
    const ride = await Ride.findById(id)
    if (!ride) {
      return c.json({ error: 'Ride no encontrado' }, 404)
    }
    
    // Validar que es el driver asignado
    if (ride.driverId !== user.clerkId) {
      return c.json({ error: 'No eres el conductor de este ride' }, 403)
    }
    
    // Validar body con Zod
    const result = deliveryPhotoSchema.safeParse(body)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      return c.json({ error: 'Validación fallida', details: errors }, 400)
    }
    
    // Validar que está en estado 'in_progress'
    if (ride.status !== 'in_progress') {
      return c.json(
        { error: 'Solo puedes subir foto en estado "in_progress"' },
        400
      )
    }
    
    const updated = await Ride.findByIdAndUpdate(
      id,
      {
        deliveryPhoto: result.data,
        status: 'completed',
        updatedAt: new Date()
      },
      { new: true }
    )
    
    return c.json({
      success: true,
      ride: updated,
      message: 'Foto de entrega subida. Esperando confirmación del cliente.',
    })
  } catch (err) {
    console.error('Error subiendo foto:', err)
    return c.json({ error: 'Error al subir la foto' }, 500)
  }
})

export default rides
