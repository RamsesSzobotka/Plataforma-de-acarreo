import { Hono } from 'hono/tiny'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { Ride } from '../models/ride'

const admin = new Hono()

// === ESTADÍSTICAS ===

admin.get('/stats', async (c) => {
  const [
    totalUsers,
    totalDrivers,
    pendingDrivers,
    verifiedDrivers,
    totalRides,
    ridesCompleted,
    ridesInProgress,
  ] = await Promise.all([
    User.countDocuments({ role: 'client' }),
    User.countDocuments({ role: 'driver' }),
    Driver.countDocuments({ verificationStatus: 'pending' }),
    Driver.countDocuments({ verificationStatus: 'verified' }),
    Ride.countDocuments(),
    Ride.countDocuments({ status: 'completed' }),
    Ride.countDocuments({ status: { $in: ['in_progress', 'accepted'] } }),
  ])

  return c.json({
    users: { total: totalUsers, drivers: totalDrivers },
    drivers: { pending: pendingDrivers, verified: verifiedDrivers },
    rides: { total: totalRides, completed: ridesCompleted, inProgress: ridesInProgress },
  })
})

// === GESTIÓN DE USUARIOS ===

// Listar todos los usuarios
admin.get('/users', async (c) => {
  const role = c.req.query('role')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  // Aceptar "todos" o vacío como "sin filtro"
  const query: any = (role && role !== 'todos') ? { role } : {}

  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ])

  return c.json({
    data: users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})

// Obtener usuario por clerkId
admin.get('/users/:clerkId', async (c) => {
  const clerkId = c.req.param('clerkId')
  const user = await User.findOne({ clerkId })

  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }

  return c.json(user)
})

// Actualizar usuario
admin.patch('/users/:clerkId', async (c) => {
  const clerkId = c.req.param('clerkId')
  const body = await c.req.json()

  const updateData: any = { updatedAt: new Date() }
  if (body.firstName) updateData.firstName = body.firstName
  if (body.lastName) updateData.lastName = body.lastName
  if (body.phone) updateData.phone = body.phone
  if (body.role && ['client', 'driver', 'admin'].includes(body.role)) {
    updateData.role = body.role
  }
  if (body.isActive !== undefined) updateData.isActive = body.isActive

  const user = await User.findOneAndUpdate(
    { clerkId },
    updateData,
    { new: true }
  )

  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }

  return c.json(user)
})

// Eliminar usuario
admin.delete('/users/:clerkId', async (c) => {
  const clerkId = c.req.param('clerkId')

  const user = await User.findOneAndDelete({ clerkId })

  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }

  return c.json({ success: true, message: 'Usuario eliminado' })
})

// === GESTIÓN DE DRIVERS ===

// Listar todos los drivers con filtros
admin.get('/drivers', async (c) => {
  const status = c.req.query('status')
  const isAvailable = c.req.query('available')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  // Aceptar "todos" o vacío como "sin filtro"
  const query: any = {}
  if (status && status !== 'todos') query.verificationStatus = status
  if (isAvailable !== undefined && isAvailable !== 'todos') query.isAvailable = isAvailable === 'true'

  const skip = (page - 1) * limit

  const [drivers, total] = await Promise.all([
    Driver.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Driver.countDocuments(query),
  ])

  // Agregar info del usuario
  const driversWithUser = await Promise.all(
    drivers.map(async (driver) => {
      const user = await User.findOne({ clerkId: driver.userId })
      return {
        ...driver.toObject(),
        user: user
          ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              imageUrl: user.imageUrl,
              role: user.role,
            }
          : null,
      }
    })
  )

  return c.json({
    data: driversWithUser,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})

// Obtener driver por userId
admin.get('/drivers/:userId', async (c) => {
  const userId = c.req.param('userId')

  const driver = await Driver.findOne({ userId })
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  const user = await User.findOne({ clerkId: userId })

  return c.json({
    ...driver.toObject(),
    user: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          imageUrl: user.imageUrl,
        }
      : null,
  })
})

// Aprobar driver
admin.post('/drivers/:userId/approve', async (c) => {
  const userId = c.req.param('userId')

  const driver = await Driver.findOneAndUpdate(
    { userId },
    {
      verificationStatus: 'verified',
      isAvailable: true,
      isVerified: true,
      updatedAt: new Date(),
    },
    { new: true }
  )

  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  // Actualizar rol del usuario a driver
  await User.findOneAndUpdate(
    { clerkId: userId },
    { role: 'driver', updatedAt: new Date() }
  )

  return c.json({
    success: true,
    driver: {
      userId: driver.userId,
      verificationStatus: driver.verificationStatus,
    },
  })
})

// Rechazar driver
admin.post('/drivers/:userId/reject', async (c) => {
  const userId = c.req.param('userId')
  const { reason } = await c.req.json()

  const driver = await Driver.findOneAndUpdate(
    { userId },
    {
      verificationStatus: 'rejected',
      rejectionReason: reason || 'No especificado',
      updatedAt: new Date(),
    },
    { new: true }
  )

  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  return c.json({
    success: true,
    driver: {
      userId: driver.userId,
      verificationStatus: driver.verificationStatus,
      rejectionReason: driver.rejectionReason,
    },
  })
})

// Revisar driver (poner en review)
admin.post('/drivers/:userId/review', async (c) => {
  const userId = c.req.param('userId')

  const driver = await Driver.findOneAndUpdate(
    { userId },
    { verificationStatus: 'in_review', updatedAt: new Date() },
    { new: true }
  )

  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  return c.json({
    success: true,
    driver: { userId: driver.userId, verificationStatus: driver.verificationStatus },
  })
})

// Suspender driver
admin.post('/drivers/:userId/suspend', async (c) => {
  const userId = c.req.param('userId')
  const { reason } = await c.req.json()

  const driver = await Driver.findOneAndUpdate(
    { userId },
    {
      verificationStatus: 'suspended',
      rejectionReason: reason || 'Suspendido por el admin',
      isAvailable: false,
      updatedAt: new Date(),
    },
    { new: true }
  )

  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  return c.json({
    success: true,
    driver: { userId: driver.userId, verificationStatus: driver.verificationStatus },
  })
})

// Actualizar driver
admin.patch('/drivers/:userId', async (c) => {
  const userId = c.req.param('userId')
  const body = await c.req.json()

  const updateData: any = { updatedAt: new Date() }

  if (body.vehicleType) updateData.vehicleType = body.vehicleType
  if (body.plate) updateData.plate = body.plate
  if (body.capacityKg) updateData.capacityKg = body.capacityKg
  if (body.phone) updateData.phone = body.phone
  if (body.isAvailable !== undefined) updateData.isAvailable = body.isAvailable

  const driver = await Driver.findOneAndUpdate({ userId }, updateData, { new: true })

  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  return c.json(driver)
})

// === GESTIÓN DE RIDES ===

// Listar rides con filtros
admin.get('/rides', async (c) => {
  const status = c.req.query('status')
  const clientId = c.req.query('clientId')
  const driverId = c.req.query('driverId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  const query: any = {}
  // Aceptar "todos" o vacío como "sin filtro"
  if (status && status !== 'todos') query.status = status
  if (clientId && clientId !== 'todos') query.clientId = clientId
  if (driverId && driverId !== 'todos') query.driverId = driverId

  const skip = (page - 1) * limit

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('clientId', 'firstName lastName email')
      .populate('driverId', 'firstName lastName'),
    Ride.countDocuments(query),
  ])

  return c.json({
    data: rides,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})

// Obtener ride por ID
admin.get('/rides/:id', async (c) => {
  const id = c.req.param('id')

  const ride = await Ride.findById(id)
    .populate('clientId', 'firstName lastName email imageUrl')
    .populate('driverId', 'firstName lastName email imageUrl')

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  return c.json(ride)
})

// Actualizar ride
admin.patch('/rides/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const updateData: any = { updatedAt: new Date() }
  if (body.title) updateData.title = body.title
  if (body.description) updateData.description = body.description
  if (body.estimatedPrice) updateData.estimatedPrice = body.estimatedPrice
  if (body.finalPrice) updateData.finalPrice = body.finalPrice
  if (body.packages) updateData.packages = body.packages
  if (body.weight) updateData.weight = body.weight
  if (body.notes !== undefined) updateData.notes = body.notes

  const ride = await Ride.findByIdAndUpdate(id, updateData, { new: true })

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  return c.json(ride)
})

// Cambiar estado del ride
admin.patch('/rides/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()

  const validStatuses = ['requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled']
  if (!status || !validStatuses.includes(status)) {
    return c.json({ error: `Status debe ser uno de: ${validStatuses.join(', ')}` }, 400)
  }

  const ride = await Ride.findByIdAndUpdate(
    id,
    { status, updatedAt: new Date() },
    { new: true }
  )

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  return c.json(ride)
})

// Asignar driver a ride
admin.patch('/rides/:id/assign', async (c) => {
  const id = c.req.param('id')
  const { driverId } = await c.req.json()

  if (!driverId) {
    return c.json({ error: 'driverId es requerido' }, 400)
  }

  const driver = await Driver.findOne({ userId: driverId })
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  const ride = await Ride.findByIdAndUpdate(
    id,
    { driverId, status: 'accepted', updatedAt: new Date() },
    { new: true }
  )

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  return c.json(ride)
})

// Cancelar ride (admin)
admin.post('/rides/:id/cancel', async (c) => {
  const id = c.req.param('id')
  const { reason } = await c.req.json()

  const ride = await Ride.findByIdAndUpdate(
    id,
    { status: 'cancelled', cancellationReason: reason || 'Cancelado por admin', updatedAt: new Date() },
    { new: true }
  )

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  return c.json(ride)
})

// Eliminar ride
admin.delete('/rides/:id', async (c) => {
  const id = c.req.param('id')

  const ride = await Ride.findByIdAndDelete(id)

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  return c.json({ success: true, message: 'Ride eliminado' })
})

export default admin