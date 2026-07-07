import { Hono } from 'hono/tiny'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { Ride } from '../models/ride'
import { logAudit } from '../services/audit'
import { createNotification } from '../services/notificationService'

// ── Clerk helper ──────────────────────────────────────────────────────────────
interface ClerkProfile {
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  email: string | null
}

async function getClerkUserProfiles(clerkIds: string[]): Promise<Map<string, ClerkProfile>> {
  const profiles = new Map<string, ClerkProfile>()
  if (clerkIds.length === 0) return profiles

  const results = await Promise.allSettled(
    clerkIds.map(async (id) => {
      const response = await fetch(`https://api.clerk.com/v1/users/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) return null
      const data: any = await response.json()
      return {
        id,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        imageUrl: data.image_url || null,
        email: data.email_addresses?.[0]?.email_address || null,
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      profiles.set(result.value.id, {
        firstName: result.value.firstName,
        lastName: result.value.lastName,
        imageUrl: result.value.imageUrl,
        email: result.value.email,
      })
    }
  }

  return profiles
}

const admin = new Hono()

// === AUTH ===

// Login de admin (desde base de datos)
admin.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  
  if (!email || !password) {
    return c.json({ error: 'Email y contraseña son requeridos' }, 400)
  }
  
  // Buscar usuario en MongoDB
  const user = await User.findOne({ email: email.toLowerCase() })
  
  if (!user) {
    return c.json({ error: 'Credenciales inválidas' }, 401)
  }
  
  // Verificar rol de admin
  if (user.role !== 'admin') {
    return c.json({ error: 'No tienes acceso de administrador' }, 403)
  }
  
  // Verificar contraseña
  const isValid = await user.comparePassword(password)
  
  if (!isValid) {
    return c.json({ error: 'Credenciales inválidas' }, 401)
  }
  
  if (!user.isActive) {
    return c.json({ error: 'Cuenta desactivada' }, 403)
  }
  
  // Devolver info del admin (sin contraseña)
  await logAudit({
    action: 'admin.login',
    entityType: 'user',
    entityId: email || 'unknown',
    userId: null,
    details: { success: true },
    ip,
    userAgent,
  })

  return c.json({
    success: true,
    user: {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    }
  })
})

// Verificar sesión
admin.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json({ error: 'No autorizado' }, 401)
  }
  
  try {
    const userId = authHeader.replace('Bearer ', '')
    const user = await User.findById(userId)
    
    if (!user || user.role !== 'admin') {
      return c.json({ error: 'No autorizado' }, 403)
    }
    
    return c.json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    })
  } catch (err) {
    return c.json({ error: 'Token inválido' }, 401)
  }
})

// === MIDDLEWARE DE PROTECCIÓN ===
// Este middleware se aplica a todas las rutas POST, PATCH, DELETE que vienen después
const adminAuth = async (c: any, next: any) => {
  const path = c.req.path
  
  // Rutas públicas (no requieren auth)
  if (path === '/login' || path === '/me') {
    return next()
  }
  
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json({ error: 'No autorizado - se requiere token' }, 401)
  }
  
  try {
    const userId = authHeader.replace('Bearer ', '')
    const user = await User.findById(userId)
    
    if (!user || user.role !== 'admin') {
      return c.json({ error: 'No autorizado - solo administradores' }, 403)
    }
    
    // Adjuntar usuario al contexto
    c.set('adminUser', user)
    await next()
  } catch (err) {
    return c.json({ error: 'Token inválido' }, 401)
  }
}

// Aplicar middleware a todas las rutas
admin.use('*', adminAuth)

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

// ── System resource info ────────────────────────────────────────
admin.get('/stats/system', async (c) => {
  const mem = process.memoryUsage()
  const cpu = process.cpuUsage()

  return c.json({
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      usagePercent: mem.heapTotal > 0
        ? Math.round((mem.heapUsed / mem.heapTotal) * 10000) / 100
        : 0,
    },
    cpu: {
      user: cpu.user,
      system: cpu.system,
      total: cpu.user + cpu.system,
    },
    uptime: Math.round(process.uptime() * 100) / 100,
  })
})

// ── Monitoring metrics ──────────────────────────────────────────
admin.get('/stats/monitoring', async (c) => {
  const { getMetrics } = await import('../middleware/monitoring')
  return c.json(getMetrics())
})

// ── Revenue stats ───────────────────────────────────────────────
admin.get('/stats/revenue', async (c) => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [aggregation, ridesPaidToday, ridesPaidThisMonth] = await Promise.all([
    Ride.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalPrice' },
          totalFees: { $sum: '$platformFee' },
          totalDriverPayouts: { $sum: '$driverAmount' },
          totalRides: { $sum: 1 },
        },
      },
    ]),
    Ride.countDocuments({ status: 'paid', paidAt: { $gte: startOfToday } }),
    Ride.countDocuments({ status: 'paid', paidAt: { $gte: startOfMonth } }),
  ])

  const totals = aggregation[0] || { totalRevenue: 0, totalFees: 0, totalDriverPayouts: 0, totalRides: 0 }

  return c.json({
    totalRevenue: totals.totalRevenue,
    totalFees: totals.totalFees,
    totalDriverPayouts: totals.totalDriverPayouts,
    totalRidesPaid: totals.totalRides,
    ridesPaidToday,
    ridesPaidThisMonth,
  })
})

// ── Monthly reports ─────────────────────────────────────────────
admin.get('/stats/reports/monthly', async (c) => {
  const monthsParam = Math.min(parseInt(c.req.query('months') || '12'), 60)
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - monthsParam)
  startDate.setDate(1)
  startDate.setHours(0, 0, 0, 0)

  // 1. Monthly revenue aggregation from paid rides
  const revenueAgg = await Ride.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: startDate } } },
    {
      $group: {
        _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
        revenue: { $sum: '$finalPrice' },
        fees: { $sum: '$platformFee' },
        driverPayouts: { $sum: '$driverAmount' },
        ridesPaid: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ])

  // 2. Monthly rides by status
  const ridesAgg = await Ride.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ])

  // 3. Monthly new users
  const usersAgg = await User.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, role: '$role' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ])

  // Merge all aggregations into a month-by-month array
  type MonthKey = string
  function mk(y: number, m: number): MonthKey {
    return `${y}-${m}`
  }

  const revenueByMonth = new Map<MonthKey, any>()
  for (const r of revenueAgg) {
    const key = mk(r._id.year, r._id.month)
    revenueByMonth.set(key, {
      revenue: r.revenue,
      fees: r.fees,
      driverPayouts: r.driverPayouts,
      ridesPaid: r.ridesPaid,
    })
  }

  const ridesByMonth = new Map<MonthKey, any>()
  for (const r of ridesAgg) {
    const key = mk(r._id.year, r._id.month)
    if (!ridesByMonth.has(key))
      ridesByMonth.set(key, { ridesCompleted: 0, ridesCancelled: 0, ridesRequested: 0, ridesInProgress: 0 })
    const entry = ridesByMonth.get(key)!
    if (r._id.status === 'completed') entry.ridesCompleted += r.count
    else if (r._id.status === 'cancelled') entry.ridesCancelled += r.count
    else if (r._id.status === 'requested') entry.ridesRequested += r.count
    else if (r._id.status === 'in_progress') entry.ridesInProgress += r.count
    else entry.ridesRequested += r.count
  }

  const usersByMonth = new Map<MonthKey, any>()
  for (const r of usersAgg) {
    const key = mk(r._id.year, r._id.month)
    if (!usersByMonth.has(key)) usersByMonth.set(key, { newClients: 0, newDrivers: 0 })
    const entry = usersByMonth.get(key)!
    if (r._id.role === 'client') entry.newClients += r.count
    else if (r._id.role === 'driver') entry.newDrivers += r.count
  }

  // Build monthly array going back N months
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  const months: any[] = []
  const now = new Date()
  const totals = {
    totalRevenue: 0,
    totalFees: 0,
    totalDriverPayouts: 0,
    totalRidesCompleted: 0,
    totalRidesPaid: 0,
    totalRidesCancelled: 0,
    totalNewClients: 0,
    totalNewDrivers: 0,
  }

  for (let i = monthsParam - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = mk(y, m)

    const rev = revenueByMonth.get(key) || { revenue: 0, fees: 0, driverPayouts: 0, ridesPaid: 0 }
    const rid = ridesByMonth.get(key) || { ridesCompleted: 0, ridesCancelled: 0, ridesRequested: 0, ridesInProgress: 0 }
    const usr = usersByMonth.get(key) || { newClients: 0, newDrivers: 0 }

    const entry = {
      year: y,
      month: m,
      label: `${monthNames[m - 1]} ${y}`,
      ...rev,
      ...rid,
      ...usr,
    }
    months.push(entry)

    totals.totalRevenue += rev.revenue
    totals.totalFees += rev.fees
    totals.totalDriverPayouts += rev.driverPayouts
    totals.totalRidesCompleted += rid.ridesCompleted
    totals.totalRidesPaid += rev.ridesPaid
    totals.totalRidesCancelled += rid.ridesCancelled
    totals.totalNewClients += usr.newClients
    totals.totalNewDrivers += usr.newDrivers
  }

  return c.json({ months, totals })
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

  // Enrich with Clerk data for imageUrl and fresh names
  const clerkIds = users.map((u: any) => u.clerkId).filter(Boolean) as string[]

  let clerkProfiles = new Map()
  if (clerkIds.length > 0) {
    clerkProfiles = await getClerkUserProfiles(clerkIds)
  }

  const enrichedUsers = users.map((user: any) => {
    const clerkData = clerkProfiles.get(user.clerkId)
    if (clerkData) {
      user.imageUrl = clerkData.imageUrl || user.imageUrl
      user.firstName = clerkData.firstName || user.firstName
      user.lastName = clerkData.lastName || user.lastName
      user.email = clerkData.email || user.email
    }
    return user
  })

  return c.json({
    data: enrichedUsers,
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
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

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

  await logAudit({
    action: 'admin.user_update',
    entityType: 'user',
    entityId: clerkId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { fields: Object.keys(updateData) },
    ip,
    userAgent,
  })

  return c.json(user)
})

// Eliminar usuario
admin.delete('/users/:clerkId', async (c) => {
  const clerkId = c.req.param('clerkId')
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const user = await User.findOneAndDelete({ clerkId })

  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }

  await logAudit({
    action: 'admin.user_delete',
    entityType: 'user',
    entityId: clerkId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    ip,
    userAgent,
  })

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

  // Get Clerk data for all driver userIds
  const driverUserIds = drivers.map((d: any) => d.userId).filter(Boolean) as string[]
  let clerkProfiles = new Map()
  if (driverUserIds.length > 0) {
    clerkProfiles = await getClerkUserProfiles(driverUserIds)
  }

  // Merge Clerk data into drivers
  const driversWithUser = drivers.map((driver: any) => {
    const clerkData = clerkProfiles.get(driver.userId)
    return {
      ...driver.toObject(),
      user: clerkData
        ? {
            firstName: clerkData.firstName,
            lastName: clerkData.lastName,
            imageUrl: clerkData.imageUrl,
            email: clerkData.email,
          }
        : { firstName: driver.firstName, lastName: driver.lastName, imageUrl: driver.imageUrl },
    }
  })

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

  // Get fresh data from Clerk
  const clerkData = await getClerkUserProfiles([userId]).then((profiles) => profiles.get(userId))

  return c.json({
    ...driver.toObject(),
    user: clerkData
      ? {
          firstName: clerkData.firstName,
          lastName: clerkData.lastName,
          imageUrl: clerkData.imageUrl,
          email: clerkData.email,
        }
      : null,
  })
})

// Aprobar driver
admin.post('/drivers/:userId/approve', async (c) => {
  const userId = c.req.param('userId')
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

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

  await logAudit({
    action: 'admin.driver_approve',
    entityType: 'driver',
    entityId: userId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    ip,
    userAgent,
  })

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
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

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

  await logAudit({
    action: 'admin.driver_reject',
    entityType: 'driver',
    entityId: userId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { reason: reason || 'No especificado' },
    ip,
    userAgent,
  })

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
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const driver = await Driver.findOneAndUpdate(
    { userId },
    { verificationStatus: 'in_review', updatedAt: new Date() },
    { new: true }
  )

  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  await logAudit({
    action: 'admin.driver_review',
    entityType: 'driver',
    entityId: userId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    ip,
    userAgent,
  })

  return c.json({
    success: true,
    driver: { userId: driver.userId, verificationStatus: driver.verificationStatus },
  })
})

// Suspender driver
admin.post('/drivers/:userId/suspend', async (c) => {
  const userId = c.req.param('userId')
  const { reason } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

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

  await logAudit({
    action: 'admin.driver_suspend',
    entityType: 'driver',
    entityId: userId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { reason: reason || 'No especificado' },
    ip,
    userAgent,
  })

  return c.json({
    success: true,
    driver: { userId: driver.userId, verificationStatus: driver.verificationStatus },
  })
})

// Actualizar driver
admin.patch('/drivers/:userId', async (c) => {
  const userId = c.req.param('userId')
  const body = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

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

  await logAudit({
    action: 'admin.driver_update',
    entityType: 'driver',
    entityId: userId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { fields: Object.keys(updateData) },
    ip,
    userAgent,
  })

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
      .limit(limit),
    Ride.countDocuments(query),
  ])

  // Get fresh user data from Clerk
  const clientIds = rides.map((r: any) => r.clientId).filter(Boolean) as string[]
  const driverIds = rides.map((r: any) => r.driverId).filter(Boolean) as string[]
  const allClerkIds = [...new Set([...clientIds, ...driverIds])]

  let clerkProfiles = new Map<string, { firstName: string | null; lastName: string | null; imageUrl: string | null; email: string | null }>()
  if (allClerkIds.length > 0) {
    clerkProfiles = await getClerkUserProfiles(allClerkIds)
  }

  // Build response with Clerk data
  const enrichedRides = rides.map((ride: any) => {
    const clientClerkId = ride.clientId
    const driverClerkId = ride.driverId

    const clientData = clientClerkId ? clerkProfiles.get(clientClerkId) : null
    const driverData = driverClerkId ? clerkProfiles.get(driverClerkId) : null

    return {
      ...ride.toObject(),
      clientId: {
        clerkId: clientClerkId,
        firstName: clientData?.firstName || null,
        lastName: clientData?.lastName || null,
        imageUrl: clientData?.imageUrl || null,
        email: clientData?.email || null,
      },
      driverId: driverClerkId
        ? {
            clerkId: driverClerkId,
            firstName: driverData?.firstName || null,
            lastName: driverData?.lastName || null,
            imageUrl: driverData?.imageUrl || null,
          }
        : null,
    }
  })

  return c.json({
    data: enrichedRides,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})

// Obtener ride por ID
admin.get('/rides/:id', async (c) => {
  const id = c.req.param('id')

  const ride: any = await Ride.findById(id)

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  // Get fresh user data from Clerk
  const clientClerkId = ride.clientId
  const driverClerkId = ride.driverId

  const allClerkIds = [clientClerkId, driverClerkId].filter(Boolean) as string[]
  let clerkProfiles = new Map<string, { firstName: string | null; lastName: string | null; imageUrl: string | null; email: string | null }>()

  if (allClerkIds.length > 0) {
    clerkProfiles = await getClerkUserProfiles(allClerkIds)
  }

  const clientData = clientClerkId ? clerkProfiles.get(clientClerkId) : null
  const driverData = driverClerkId ? clerkProfiles.get(driverClerkId) : null

  const enrichedRide = {
    ...ride.toObject(),
    clientId: {
      clerkId: clientClerkId,
      firstName: clientData?.firstName || null,
      lastName: clientData?.lastName || null,
      imageUrl: clientData?.imageUrl || null,
      email: clientData?.email || null,
    },
    driverId: driverClerkId
      ? {
          clerkId: driverClerkId,
          firstName: driverData?.firstName || null,
          lastName: driverData?.lastName || null,
          imageUrl: driverData?.imageUrl || null,
        }
      : null,
  }

  return c.json(enrichedRide)
})

// Actualizar ride
admin.patch('/rides/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

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

  await logAudit({
    action: 'admin.ride_update',
    entityType: 'ride',
    entityId: id,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    ip,
    userAgent,
  })

  return c.json(ride)
})

// Cambiar estado del ride
admin.patch('/rides/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const validStatuses = ['requested', 'accepted', 'in_progress', 'completed', 'paid', 'failed', 'cancelled']
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

  await logAudit({
    action: 'admin.ride_status_change',
    entityType: 'ride',
    entityId: id,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { to: status },
    ip,
    userAgent,
  })

  return c.json(ride)
})

// Asignar driver a ride
admin.patch('/rides/:id/assign', async (c) => {
  const id = c.req.param('id')
  const { driverId } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

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

  await logAudit({
    action: 'admin.ride_assign',
    entityType: 'ride',
    entityId: id,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { driverId },
    ip,
    userAgent,
  })

  return c.json(ride)
})

// Cancelar ride (admin)
admin.post('/rides/:id/cancel', async (c) => {
  const id = c.req.param('id')
  const { reason } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const ride = await Ride.findByIdAndUpdate(
    id,
    { status: 'cancelled', cancellationReason: reason || 'Cancelado por admin', updatedAt: new Date() },
    { new: true }
  )

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  await logAudit({
    action: 'admin.ride_cancel',
    entityType: 'ride',
    entityId: id,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { reason: reason || 'No especificado' },
    ip,
    userAgent,
  })

  return c.json(ride)
})

// Eliminar ride
admin.delete('/rides/:id', async (c) => {
  const id = c.req.param('id')
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const ride = await Ride.findByIdAndDelete(id)

  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  await logAudit({
    action: 'admin.ride_delete',
    entityType: 'ride',
    entityId: id,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    ip,
    userAgent,
  })

  return c.json({ success: true, message: 'Ride eliminado' })
})

// === GESTIÓN DE REPORTES ===

// Listar reportes
admin.get('/reports', async (c) => {
  const status = c.req.query('status')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  const query: any = {}
  if (status && status !== 'todos') query.status = status

  const skip = (page - 1) * limit

  const { Report } = await import('../models/report')

  const [reports, total] = await Promise.all([
    Report.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(query),
  ])

  const allClerkIds = [...new Set([
    ...reports.map((r: any) => r.reporterId).filter(Boolean),
    ...reports.map((r: any) => r.reportedId).filter(Boolean),
  ])]

  let clerkProfiles = new Map<string, any>()
  if (allClerkIds.length > 0) {
    clerkProfiles = await getClerkUserProfiles(allClerkIds)
  }

  const enrichedReports = reports.map((report: any) => {
    const reporterData = clerkProfiles.get(report.reporterId)
    const reportedData = clerkProfiles.get(report.reportedId)
    return {
      ...report.toObject(),
      reporter: reporterData ? {
        firstName: reporterData.firstName,
        lastName: reporterData.lastName,
        imageUrl: reporterData.imageUrl,
        email: reporterData.email,
      } : null,
      reported: reportedData ? {
        firstName: reportedData.firstName,
        lastName: reportedData.lastName,
        imageUrl: reportedData.imageUrl,
        email: reportedData.email,
      } : null,
    }
  })

  return c.json({
    data: enrichedReports,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})

// Actualizar estado de reporte
admin.patch('/reports/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const validStatuses = ['pending', 'in_review', 'resolved']
  if (!status || !validStatuses.includes(status)) {
    return c.json({ error: `Status debe ser uno de: ${validStatuses.join(', ')}` }, 400)
  }

  const { Report } = await import('../models/report')
  const report = await Report.findByIdAndUpdate(
    id,
    { status, updatedAt: new Date() },
    { new: true }
  )

  if (!report) {
    return c.json({ error: 'Reporte no encontrado' }, 404)
  }

  await logAudit({
    action: 'admin.report_status',
    entityType: 'report',
    entityId: id,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    details: { to: status },
    ip,
    userAgent,
  })

  if (status === 'resolved' && report) {
    await createNotification(
      report.reporterId,
      'report_response',
      'Respuesta a tu reporte',
      'Tu reporte ha sido revisado y resuelto por el equipo de Carglyn.',
      undefined,
      { reportId: id }
    )
  }

  return c.json(report)
})

export default admin