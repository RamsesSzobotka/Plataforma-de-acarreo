import { Hono } from 'hono/tiny'
import { Ride } from '../models/ride'
import { Driver } from '../models/driver'
import { User } from '../models/user'
import { authMiddleware } from '../middleware/auth'
import { roleMiddleware } from '../middleware/role'
import { verifyDriverMiddleware } from '../middleware/verify-driver'
import { calculateDistanceToGeoJSON } from '../utils/haversine'

const rides = new Hono()

/**
 * GET /api/rides - Listar rides (filtrado por ubicación geoespacial para drivers)
 * 
 * Soporta dos modos:
 * 1. Geospatial (para drivers): lat, lng, radius → retorna rides ordenados por distancia
 * 2. Filtrado simple (para clientes): status, clientId, driverId → retorna rides paginados
 * 
 * Query params (geospatial mode):
 * - lat (required): latitud del driver (-90 a 90)
 * - lng (required): longitud del driver (-180 a 180)
 * - radius (optional, default: 25): radio en km (5, 10, 25, 50)
 * - limit (optional, default: 20): máximo rides por página
 * - skip (optional, default: 0): offset para paginación
 * - status (optional, default: "requested,negotiating"): estados a filtrar
 */
rides.get('/', authMiddleware, async (c) => {
  const lat = c.req.query('lat')
  const lng = c.req.query('lng')
  const radius = c.req.query('radius') || '25'
  const limit = parseInt(c.req.query('limit') || '20')
  const skip = parseInt(c.req.query('skip') || '0')
  const status = c.req.query('status') || 'requested,negotiating'

  // MODE 1: Geospatial filtering (if lat/lng provided)
  if (lat && lng) {
    // Validate coordinates
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return c.json(
        { error: 'Invalid coordinates provided' },
        400,
      )
    }

    if (latNum < -90 || latNum > 90) {
      return c.json(
        { error: 'lat must be between -90 and 90' },
        400,
      )
    }

    if (lngNum < -180 || lngNum > 180) {
      return c.json(
        { error: 'lng must be between -180 and 180' },
        400,
      )
    }

    // Validate radius
    const validRadii = [5, 10, 25, 50]
    const radiusNum = parseInt(radius)
    if (!validRadii.includes(radiusNum)) {
      return c.json(
        { error: 'radius must be one of: 5, 10, 25, 50' },
        400,
      )
    }

    // Parse status filter
    const statuses = status.split(',').map((s) => s.trim())

    try {
      // Query rides: filter by status, then by distance using 2dsphere
      const rides_docs = await Ride.find({
        status: { $in: statuses },
        'pickupLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lngNum, latNum],
            },
            $maxDistance: radiusNum * 1000, // convert km to meters
          },
        },
      })
        .limit(limit)
        .skip(skip)

      // Calculate distance for each ride (Haversine)
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

      // Get total count for pagination
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

  // MODE 2: Simple filtering (for clients listing their own rides, etc)
  const query: any = {}
  const clientIdParam = c.req.query('clientId')
  const driverIdParam = c.req.query('driverId')
  const statusParam = c.req.query('status')

  if (statusParam) query.status = statusParam
  if (clientIdParam) query.clientId = clientIdParam
  if (driverIdParam) query.driverId = driverIdParam

  try {
    const ridesList = await Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Ride.countDocuments(query)

    return c.json({
      success: true,
      data: ridesList,
      pagination: {
        total,
        limit,
        skip,
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
 * 
 * Incluye:
 * - Todos los campos del ride
 * - Perfil completo del cliente
 * - Distancia calculada (si se pasan driverLat/driverLng)
 * - Mensajes de chat (solo si el driver es el asignado)
 */
rides.get('/:id', authMiddleware, async (c) => {
  const rideId = c.req.param('id')
  const driverLat = c.req.query('driverLat')
  const driverLng = c.req.query('driverLng')

  try {
    const ride = await Ride.findById(rideId)

    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    // Get client profile
    const clientUser = await User.findOne({ clerkId: ride.clientId })

    // Calculate distance if driver location provided
    let distance: number | undefined
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

    const rideObj = ride.toObject()

    return c.json({
      success: true,
      ride: {
        ...rideObj,
        distance,
        client: clientUser
          ? {
              clerkId: clientUser.clerkId,
              firstName: clientUser.firstName,
              lastName: clientUser.lastName,
              imageUrl: clientUser.imageUrl,
              email: clientUser.email,
              // TODO: fetch rating from ratings collection
            }
          : null,
      },
    })
  } catch (err) {
    console.error('Ride detail fetch error:', err)
    return c.json({ error: 'Failed to fetch ride details' }, 500)
  }
})

/**
 * POST /api/rides - Crear nuevo ride (cliente)
 */
rides.post('/', authMiddleware, roleMiddleware('client'), async (c) => {
  const user = c.get('user')

  try {
    const body = await c.req.json()

    const ride = new Ride({
      ...body,
      clientId: user.clerkId,
      status: 'requested',
    })

    await ride.save()

    return c.json({
      success: true,
      ride,
    }, 201)
  } catch (err) {
    console.error('Create ride error:', err)
    return c.json({ error: 'Failed to create ride' }, 500)
  }
})

/**
 * POST /api/rides/:id/accept - Aceptar ride (driver)
 * 
 * Validaciones:
 * - Driver debe estar verificado (verifyDriverMiddleware)
 * - Ride no debe tener driverId ya asignado
 * - Ride status debe ser "requested" o "negotiating"
 * 
 * Cambios:
 * - ride.status → "accepted"
 * - ride.driverId → clerkId del driver
 * - ride.finalPrice → precio negociado (o estimado si no se proporciona)
 * - ride.chatEnabled → true
 * - ride.updatedAt → ahora
 */
rides.post(
  '/:id/accept',
  authMiddleware,
  roleMiddleware('driver'),
  verifyDriverMiddleware,
  async (c) => {
    const rideId = c.req.param('id')
    const user = c.get('user')

    try {
      const body = await c.req.json()
      const { finalPrice } = body

      // Fetch ride
      const ride = await Ride.findById(rideId)

      if (!ride) {
        return c.json({ error: 'Ride not found' }, 404)
      }

      // Validate ride is available (no driverId yet)
      if (ride.driverId) {
        return c.json(
          { error: 'Ride already accepted by another driver' },
          400,
        )
      }

      // Validate ride status
      if (!['requested', 'negotiating'].includes(ride.status)) {
        return c.json(
          {
            error: `Ride cannot be accepted in status: ${ride.status}`,
          },
          400,
        )
      }

      // Validate finalPrice if provided
      if (finalPrice !== undefined && finalPrice < 0) {
        return c.json(
          { error: 'finalPrice must be a positive number' },
          400,
        )
      }

      // Update ride
      ride.driverId = user.clerkId
      ride.status = 'accepted'
      ride.finalPrice = finalPrice || ride.estimatedPrice
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
      return c.json({ error: 'Failed to accept ride' }, 500)
    }
  },
)

/**
 * POST /api/rides/:id/cancel - Cancelar ride aceptado (driver)
 * 
 * Solo un driver puede cancelar su propio ride, y solo en status "accepted"
 * 
 * Cambios:
 * - ride.status → "requested" (vuelve disponible para otros drivers)
 * - ride.driverId → null
 * - ride.finalPrice → null
 * - cancellationReason → logged
 */
rides.post(
  '/:id/cancel',
  authMiddleware,
  roleMiddleware('driver'),
  async (c) => {
    const rideId = c.req.param('id')
    const user = c.get('user')

    try {
      const { reason } = await c.req.json()

      // Validate reason provided
      if (!reason || typeof reason !== 'string') {
        return c.json(
          { error: 'Cancellation reason is required' },
          400,
        )
      }

      if (reason.length > 200) {
        return c.json(
          { error: 'Reason must be ≤200 characters' },
          400,
        )
      }

      // Fetch ride
      const ride = await Ride.findById(rideId)

      if (!ride) {
        return c.json({ error: 'Ride not found' }, 404)
      }

      // Validate driver owns this ride
      if (ride.driverId !== user.clerkId) {
        return c.json(
          { error: 'You are not the assigned driver for this ride' },
          403,
        )
      }

      // Validate ride is in accepted status
      if (ride.status !== 'accepted') {
        return c.json(
          {
            error: `Ride cannot be cancelled in status: ${ride.status}`,
          },
          400,
        )
      }

      // Update ride (cancel and revert to available)
      ride.status = 'requested'
      ride.driverId = null
      ride.finalPrice = undefined
      ride.cancellationReason = reason
      ride.updatedAt = new Date()

      await ride.save()

      return c.json({
        success: true,
        ride: ride.toObject(),
        message:
          'Cancellation recorded. Ride is now available for other drivers.',
      })
    } catch (err) {
      console.error('Cancel ride error:', err)
      return c.json({ error: 'Failed to cancel ride' }, 500)
    }
  },
)

// Actualizar ride (cliente)
rides.patch('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  try {
    const ride = await Ride.findById(id)

    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    // Verify ownership (client only)
    if (ride.clientId !== user.clerkId) {
      return c.json(
        { error: 'You do not own this ride' },
        403,
      )
    }

    // Validate can edit (only in requested or negotiating status)
    if (!['requested', 'negotiating'].includes(ride.status)) {
      return c.json(
        { error: `Cannot edit ride in status: ${ride.status}` },
        400,
      )
    }

    const body = await c.req.json()
    const updated = await Ride.findByIdAndUpdate(id, body, { new: true })

    return c.json({ success: true, ride: updated })
  } catch (err) {
    console.error('Update ride error:', err)
    return c.json({ error: 'Failed to update ride' }, 500)
  }
})

// Cambiar estado del ride (admin/internal)
rides.patch('/:id/status', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { status, reason } = await c.req.json()

  // TODO: Agregar validación de permisos (admin only)

  try {
    const update: any = { status }
    if (reason) update.cancellationReason = reason

    const ride = await Ride.findByIdAndUpdate(id, update, { new: true })

    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    return c.json({ success: true, ride })
  } catch (err) {
    console.error('Update ride status error:', err)
    return c.json({ error: 'Failed to update ride status' }, 500)
  }
})

// Iniciar trackeo (driver confirma carga)
rides.post('/:id/start', authMiddleware, roleMiddleware('driver'), async (c) => {
  const id = c.req.param('id')

  try {
    const ride = await Ride.findByIdAndUpdate(
      id,
      { status: 'in_progress', updatedAt: new Date() },
      { new: true },
    )

    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    return c.json({ success: true, ride })
  } catch (err) {
    console.error('Start ride error:', err)
    return c.json({ error: 'Failed to start ride' }, 500)
  }
})

// Subir foto de entrega
rides.post('/:id/delivery-photo', authMiddleware, async (c) => {
  const id = c.req.param('id')

  try {
    const { url, publicId } = await c.req.json()

    const ride = await Ride.findByIdAndUpdate(
      id,
      {
        deliveryPhoto: { url, publicId },
        updatedAt: new Date(),
      },
      { new: true },
    )

    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    return c.json({ success: true, ride })
  } catch (err) {
    console.error('Upload delivery photo error:', err)
    return c.json({ error: 'Failed to upload delivery photo' }, 500)
  }
})

export default rides
