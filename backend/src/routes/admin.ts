import { Hono } from 'hono/tiny'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { Ride } from '../models/ride'
import { AuditLog } from '../models/auditLog'
import { Setting } from '../models/setting'
import { logAudit } from '../services/audit'
import { createNotification } from '../services/notificationService'
import { setDebugMode, getDebugMode } from '../utils/debugLogger'
import { mongoose } from '../db/mongo'

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

// === SETTINGS ===

// Get all settings (for now just debugMode)
admin.get('/settings', async (c) => {
  const setting = await Setting.findOne({ key: 'debugMode' })
  const debugMode = setting?.value === true
  return c.json({ debugMode })
})

// Update debug mode
admin.patch('/settings', async (c) => {
  const { debugMode } = await c.req.json()
  if (typeof debugMode !== 'boolean') {
    return c.json({ error: 'debugMode must be a boolean' }, 400)
  }

  await Setting.findOneAndUpdate(
    { key: 'debugMode' },
    { key: 'debugMode', value: debugMode },
    { upsert: true, new: true }
  )

  setDebugMode(debugMode)
  if (getDebugMode()) {
    const adminUser: any = c.get('adminUser')
    console.log(`[Admin] ⚙️ Debug mode ${debugMode ? 'activado' : 'desactivado'} por admin ${adminUser?.clerkId || 'unknown'}`)
  }

  return c.json({ debugMode, message: `Debug mode ${debugMode ? 'activado' : 'desactivado'}` })
})

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

  // Save old state to detect changes
  const oldUser = await User.findOne({ clerkId })

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

  // Notify user if they were suspended (isActive changed from true to false)
  if (body.isActive === false && oldUser?.isActive !== false) {
    await createNotification(
      clerkId,
      'account_suspended',
      'Cuenta suspendida',
      'Tu cuenta ha sido suspendida por el administrador.',
      undefined,
      {}
    )
  }

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

  // Notify the driver
  const suspendReason = reason || 'Incumplimiento de términos'
  await createNotification(
    userId,
    'account_suspended',
    'Cuenta suspendida',
    `Tu cuenta ha sido suspendida por el administrador. Motivo: ${suspendReason}`,
    undefined,
    {}
  )

  return c.json({
    success: true,
    driver: { userId: driver.userId, verificationStatus: driver.verificationStatus },
  })
})

// Quitar suspensión de driver
admin.post('/drivers/:userId/unsuspend', async (c) => {
  const userId = c.req.param('userId')
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const driver = await Driver.findOneAndUpdate(
    { userId },
    {
      verificationStatus: 'verified',
      rejectionReason: '',
      isAvailable: true,
      updatedAt: new Date(),
    },
    { new: true }
  )

  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }

  await logAudit({
    action: 'admin.driver_unsuspend',
    entityType: 'driver',
    entityId: userId,
    userId: adminUser?.clerkId || null,
    userRole: 'admin',
    ip,
    userAgent,
  })

  // Notify the driver
  await createNotification(
    userId,
    'account_unsuspended',
    'Cuenta reactivada',
    'Tu cuenta ha sido reactivada por el administrador. Ya puedes aceptar pedidos.',
    undefined,
    {}
  )

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

  // Notify client and driver
  const cancelReason = reason || 'Cancelado por el administrador'
  if (ride.clientId) {
    await createNotification(
      ride.clientId,
      'ride_status',
      'Acarreo cancelado',
      `Tu acarreo "${ride.title}" ha sido cancelado por el administrador. Motivo: ${cancelReason}`,
      undefined,
      { rideId: id }
    )
  }
  if (ride.driverId) {
    await createNotification(
      ride.driverId,
      'ride_status',
      'Acarreo cancelado',
      `El acarreo "${ride.title}" ha sido cancelado por el administrador. Motivo: ${cancelReason}`,
      undefined,
      { rideId: id }
    )
  }

  return c.json(ride)
})

// Reembolsar ride (admin) - POST /api/admin/rides/:id/refund
admin.post('/rides/:id/refund', async (c) => {
  const id = c.req.param('id')
  const { reportId, reason } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  if (!reason) {
    return c.json({ error: 'reason es requerido para el reembolso' }, 400)
  }

  // Get the ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  // Validate ride has paymentIntentId
  if (!ride.paymentIntentId) {
    return c.json({ error: 'Este ride no tiene un pago asociado para reembolsar' }, 400)
  }

  // Import refundPayment from stripeMarketplace service
  const { refundPayment } = await import('../services/stripeMarketplace')

  try {
    // Create Stripe refund
    const refund = await refundPayment(ride.paymentIntentId, reason)

    // Update ride status and refund info
    const updatedRide = await Ride.findByIdAndUpdate(
      id,
      {
        status: 'cancelled',
        refundId: refund.id,
        refundedAt: new Date(),
        refundReason: reason,
        updatedAt: new Date(),
      },
      { new: true }
    )

    // If reportId is provided, update the report as well
    if (reportId) {
      const { Report } = await import('../models/report')
      await Report.findByIdAndUpdate(
        reportId,
        {
          status: 'resolved',
          resolution: 'refunded',
          resolvedBy: adminUser?.clerkId || null,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true }
      )
    }

    // Audit log
    await logAudit({
      action: 'admin.ride_refund',
      entityType: 'ride',
      entityId: id,
      userId: adminUser?.clerkId || null,
      userRole: 'admin',
      details: {
        reason,
        refundId: refund.id,
        reportId: reportId || null,
        paymentIntentId: ride.paymentIntentId,
      },
      ip,
      userAgent,
    })

    // Notify client and driver
    const refundAmount = ride.finalPrice || ride.estimatedPrice
    if (ride.clientId) {
      await createNotification(
        ride.clientId,
        'payment_dispute',
        'Reembolso procesado',
        `Se ha procesado un reembolso de $${refundAmount} para tu acarreo "${ride.title}". Razón: ${reason}`,
        undefined,
        { rideId: id }
      )
    }
    if (ride.driverId) {
      await createNotification(
        ride.driverId,
        'payment_dispute',
        'Acarreo reembolsado',
        `El acarreo "${ride.title}" ha sido reembolsado al cliente. Razón: ${reason}`,
        undefined,
        { rideId: id }
      )
    }

    return c.json({
      success: true,
      message: 'Reembolso procesado correctamente',
      refund: {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
      },
      ride: updatedRide,
    })
  } catch (error: any) {
    console.error('Error processing refund:', error)
    return c.json({ error: 'Error al procesar el reembolso: ' + error.message }, 500)
  }
})

// Pagar al conductor (admin) - POST /api/admin/rides/:id/pay-driver
admin.post('/rides/:id/pay-driver', async (c) => {
  const id = c.req.param('id')
  const { reportId } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  // Get the ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  // Validate ride has paymentIntentId (payment was captured)
  if (!ride.paymentIntentId) {
    return c.json({ error: 'Este ride no tiene un pago asociado' }, 400)
  }

  // Validate ride doesn't already have transferId
  if (ride.transferId) {
    return c.json({ error: 'Este ride ya tiene un pago transferido al conductor' }, 400)
  }

  // Get driver's Stripe account
  const driver = await Driver.findOne({ userId: ride.driverId })

  if (!driver?.stripeAccountId) {
    return c.json({ error: 'El conductor no tiene cuenta de Stripe configurada' }, 400)
  }

  // Import transferToDriver
  const { transferToDriver } = await import('../services/stripeMarketplace')

  try {
    // Amount to transfer (90% of final price, in cents)
    const amountInCents = ride.driverAmount || Math.round((ride.finalPrice || ride.estimatedPrice) * 90)

    // Create Stripe transfer
    const transfer = await transferToDriver(driver.stripeAccountId, amountInCents, ride._id.toString())

    // Update ride: first complete, then pay
    await Ride.findByIdAndUpdate(id, {
      $set: { status: 'completed', completedAt: new Date() },
    })
    const updatedRide = await Ride.findByIdAndUpdate(
      id,
      {
        status: 'paid',
        transferId: transfer.id,
        transferredAt: new Date(),
        paidAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    )

    // If reportId is provided, update the report as well
    if (reportId) {
      const { Report } = await import('../models/report')
      await Report.findByIdAndUpdate(
        reportId,
        {
          status: 'resolved',
          resolution: 'dismissed',
          resolvedBy: adminUser?.clerkId || null,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true }
      )
    }

    // Audit log
    await logAudit({
      action: 'admin.ride_pay_driver',
      entityType: 'ride',
      entityId: id,
      userId: adminUser?.clerkId || null,
      userRole: 'admin',
      details: {
        transferId: transfer.id,
        amount: amountInCents,
        driverId: ride.driverId,
        reportId: reportId || null,
      },
      ip,
      userAgent,
    })

    // Notify client and driver
    const payAmount = ride.finalPrice || ride.estimatedPrice
    if (ride.clientId) {
      await createNotification(
        ride.clientId,
        'payment_dispute',
        'Pago al conductor procesado',
        `Se ha liberado el pago de $${payAmount} a tu conductor por el acarreo "${ride.title}".`,
        undefined,
        { rideId: id }
      )
    }
    if (ride.driverId) {
      await createNotification(
        ride.driverId,
        'payment_dispute',
        'Pago recibido',
        `Has recibido el pago de $${payAmount} por el acarreo "${ride.title}".`,
        undefined,
        { rideId: id }
      )
    }

    return c.json({
      success: true,
      message: 'Pago al conductor procesado correctamente',
      transfer: {
        id: transfer.id,
        amount: amountInCents,
      },
      ride: updatedRide,
    })
  } catch (error: any) {
    console.error('Error processing payment to driver:', error)
    return c.json({ error: 'Error al procesar el pago: ' + error.message }, 500)
  }
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

function derivePaymentStatus(ride: any): string {
  if (ride?.refundId) return 'refunded'
  if (ride?.transferId) return 'transferred'
  if (ride?.paymentIntentId) return 'charged'
  return 'none'
}

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

  const rideIds = [...new Set(reports.map((r: any) => r.rideId).filter(Boolean))]
  const rides = rideIds.length > 0
    ? await Ride.find({ _id: { $in: rideIds } }).lean()
    : []
  const ridePaymentMap = new Map(rides.map((r: any) => [r._id.toString(), derivePaymentStatus(r)]))

  const enrichedReports = reports.map((report: any) => {
    const reporterData = clerkProfiles.get(report.reporterId)
    const reportedData = clerkProfiles.get(report.reportedId)
    return {
      ...report.toObject(),
      paymentStatus: report.rideId ? ridePaymentMap.get(report.rideId.toString()) || 'none' : 'none',
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

// Get single report by ID
admin.get('/reports/:id', async (c) => {
  const id = c.req.param('id')
  const { Report } = await import('../models/report')

  const report = await Report.findById(id)
  if (!report) {
    return c.json({ error: 'Reporte no encontrado' }, 404)
  }

  // Fetch user profiles from Clerk
  const clerkIds = [report.reporterId, report.reportedId].filter(Boolean)
  let clerkProfiles = new Map<string, any>()
  if (clerkIds.length > 0) {
    clerkProfiles = await getClerkUserProfiles(clerkIds)
  }

  const reporterData = clerkProfiles.get(report.reporterId)
  const reportedData = clerkProfiles.get(report.reportedId)

  let paymentStatus = 'none'
  if (report.rideId) {
    const ride = await Ride.findById(report.rideId).lean()
    paymentStatus = derivePaymentStatus(ride)
  }

  return c.json({
    ...report.toObject(),
    paymentStatus,
    reporter: reporterData ? {
      clerkId: report.reporterId,
      firstName: reporterData.firstName,
      lastName: reporterData.lastName,
      imageUrl: reporterData.imageUrl,
      email: reporterData.email,
    } : { clerkId: report.reporterId, email: '', firstName: '', lastName: '' },
    reported: reportedData ? {
      clerkId: report.reportedId,
      firstName: reportedData.firstName,
      lastName: reportedData.lastName,
      imageUrl: reportedData.imageUrl,
      email: reportedData.email,
      role: reportedData.role,
    } : { clerkId: report.reportedId, email: '', firstName: '', lastName: '' },
  })
})

// Actualizar estado de reporte (con resolución)
admin.patch('/reports/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status, resolution } = await c.req.json()
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || ''
  const adminUser: any = c.get('adminUser')

  const validStatuses = ['pending', 'in_review', 'resolved']
  if (!status || !validStatuses.includes(status)) {
    return c.json({ error: `Status debe ser uno de: ${validStatuses.join(', ')}` }, 400)
  }

  // Validate resolution if provided
  const validResolutions = ['refunded', 'dismissed', 'warning', 'suspended', null]
  if (resolution !== undefined && !validResolutions.includes(resolution)) {
    return c.json({ error: `Resolution debe ser uno de: ${validResolutions.filter(r => r !== null).join(', ')}` }, 400)
  }

  // Build update object
  const updateData: any = { status, updatedAt: new Date() }
  
  // If setting resolution, also set resolvedBy and resolvedAt
  if (resolution) {
    updateData.resolution = resolution
    updateData.resolvedBy = adminUser?.clerkId || null
    updateData.resolvedAt = new Date()
  } else if (status === 'resolved' && !resolution) {
    // If resolving without explicit resolution, default to dismissed
    updateData.resolution = 'dismissed'
    updateData.resolvedBy = adminUser?.clerkId || null
    updateData.resolvedAt = new Date()
  }

  const { Report } = await import('../models/report')
  const report = await Report.findByIdAndUpdate(
    id,
    updateData,
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
    details: { to: status, resolution },
    ip,
    userAgent,
  })

  if (status === 'resolved' && report) {
    const resolutionType = resolution || 'dismissed'

    // Notify reporter
    let reporterTitle: string, reporterBody: string
    if (resolutionType === 'dismissed') {
      reporterTitle = 'Respuesta a tu reporte'
      reporterBody = 'Hemos revisado tu reporte y no se consideró válido. No se tomarán acciones adicionales.'
    } else if (resolutionType === 'suspended') {
      reporterTitle = 'Reporte resuelto'
      reporterBody = 'Hemos suspendido al usuario reportado. Gracias por tu reporte.'
    } else if (resolutionType === 'refunded') {
      reporterTitle = 'Reporte resuelto'
      reporterBody = 'Se ha procesado el reembolso correspondiente a tu disputa de pago.'
    } else {
      reporterTitle = 'Respuesta a tu reporte'
      reporterBody = `Tu reporte ha sido revisado y resuelto.`
    }

    await createNotification(
      report.reporterId,
      'report_response',
      reporterTitle,
      reporterBody,
      undefined,
      { reportId: id }
    )

    // Notify reported person if suspension action was taken
    if (resolutionType === 'suspended' && report.reportedId) {
      await createNotification(
        report.reportedId,
        'account_suspended',
        'Cuenta suspendida',
        'Tu cuenta ha sido suspendida debido a un reporte en tu contra. Contacta al administrador para más información.',
        undefined,
        { reportId: id }
      )
    }
  }

  return c.json(report)
})

// === AUDIT LOGS ===

admin.get('/audit-logs', async (c) => {
  const action = c.req.query('action')
  const userId = c.req.query('userId')
  const entityType = c.req.query('entityType')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20')), 50)

  const filter: Record<string, any> = {}

  if (action) filter.action = action
  if (userId) filter.userId = userId
  if (entityType) filter.entityType = entityType

  // Date range filter on metadata.timestamp
  if (from || to) {
    filter['metadata.timestamp'] = {}
    if (from) filter['metadata.timestamp'].$gte = new Date(from)
    if (to) filter['metadata.timestamp'].$lte = new Date(to)
  }

  const skip = (page - 1) * limit

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ 'metadata.timestamp': -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ])

  // Normalizar al formato estándar del admin (data + pagination)
  const data = JSON.parse(JSON.stringify(logs))

  return c.json({
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
})

// === MCP AUDIT LOGS ===

admin.get('/mcp-audit-logs', async (c) => {
  const action = c.req.query('action')
  const clerkId = c.req.query('clerkId')
  const success = c.req.query('success')
  const toolName = c.req.query('toolName')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20')), 50)

  const filter: Record<string, any> = {}

  if (action) filter.action = action
  if (clerkId) filter.clerkId = clerkId
  if (toolName) filter.toolName = toolName
  if (success === 'true') filter.success = true
  else if (success === 'false') filter.success = false

  // Date range filter on createdAt
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }

  const skip = (page - 1) * limit
  const dbInstance = mongoose.connection.db
  if (!dbInstance) {
    return c.json({ error: 'Database not connected' }, 500)
  }
  const mcpCollection = dbInstance.collection('mcpAuditLogs')

  const [logs, total] = await Promise.all([
    mcpCollection.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    mcpCollection.countDocuments(filter),
  ])

  return c.json({
    data: logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
})

// === CSV EXPORT ===

function toCSV(headers: string[], rows: string[][]): string {
  const esc = (v: string | null | undefined) => {
    if (v == null) return ''
    const s = String(v)
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n')
}

// Export rides
admin.get('/export/rides', async (c) => {
  const status = c.req.query('status')
  const from = c.req.query('from')
  const to = c.req.query('to')

  const query: any = {}
  if (status && status !== 'todos') query.status = status
  if (from || to) {
    query.createdAt = {}
    if (from) query.createdAt.$gte = new Date(from)
    if (to) query.createdAt.$lte = new Date(to)
  }

  const rides = await Ride.find(query).sort({ createdAt: -1 }).lean()

  // Enrich with Clerk data
  const allIds = [...new Set([
    ...rides.map((r: any) => r.clientId).filter(Boolean),
    ...rides.map((r: any) => r.driverId).filter(Boolean),
  ])] as string[]
  const profiles = allIds.length > 0 ? await getClerkUserProfiles(allIds) : new Map()

  const headers = ['ID', 'Título', 'Tipo', 'Descripción', 'Cliente', 'Cliente Email', 'Conductor', 'Conductor Email', 'Dirección Origen', 'Dirección Destino', 'Precio Estimado', 'Precio Final', 'Estado', 'Creado', 'Pagado']
  const rows = rides.map((r: any) => {
    const c = r.clientId ? profiles.get(r.clientId) : null
    const d = r.driverId ? profiles.get(r.driverId) : null
    return [
      r._id.toString(), r.title, r.type, r.description,
      c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '',
      c?.email || '',
      d ? `${d.firstName || ''} ${d.lastName || ''}`.trim() : '',
      d?.email || '',
      r.pickupLocation?.address || '',
      r.dropoffLocation?.address || '',
      String(r.estimatedPrice ?? ''),
      String(r.finalPrice ?? ''),
      r.status,
      r.createdAt ? new Date(r.createdAt).toISOString() : '',
      r.paidAt ? new Date(r.paidAt).toISOString() : '',
    ]
  })

  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="rides.csv"')
  return c.body(toCSV(headers, rows))
})

// Export users
admin.get('/export/users', async (c) => {
  const role = c.req.query('role')
  const from = c.req.query('from')
  const to = c.req.query('to')

  const query: any = {}
  if (role && role !== 'todos') query.role = role
  if (from || to) {
    query.createdAt = {}
    if (from) query.createdAt.$gte = new Date(from)
    if (to) query.createdAt.$lte = new Date(to)
  }

  const users = await User.find(query).sort({ createdAt: -1 }).lean()

  // Enrich with Clerk
  const clerkIds = users.map((u: any) => u.clerkId).filter(Boolean) as string[]
  const profiles = clerkIds.length > 0 ? await getClerkUserProfiles(clerkIds) : new Map()

  const headers = ['Clerk ID', 'Email', 'Nombre', 'Apellido', 'Rol', 'Activo', 'Teléfono', 'Stripe Customer ID', 'Creado']
  const rows = users.map((u: any) => {
    const p = profiles.get(u.clerkId)
    return [
      u.clerkId || '',
      p?.email || u.email || '',
      p?.firstName || u.firstName || '',
      p?.lastName || u.lastName || '',
      u.role,
      u.isActive ? 'Sí' : 'No',
      u.phone || '',
      u.stripeCustomerId || '',
      u.createdAt ? new Date(u.createdAt).toISOString() : '',
    ]
  })

  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="usuarios.csv"')
  return c.body(toCSV(headers, rows))
})

// Export payments (paid rides)
admin.get('/export/payments', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')

  const query: any = { status: 'paid' }
  if (from || to) {
    query.paidAt = {}
    if (from) query.paidAt.$gte = new Date(from)
    if (to) query.paidAt.$lte = new Date(to)
  }

  const rides = await Ride.find(query).sort({ paidAt: -1 }).lean()

  // Enrich with Clerk
  const allIds = [...new Set([
    ...rides.map((r: any) => r.clientId).filter(Boolean),
    ...rides.map((r: any) => r.driverId).filter(Boolean),
  ])] as string[]
  const profiles = allIds.length > 0 ? await getClerkUserProfiles(allIds) : new Map()

  const headers = ['Ride ID', 'Título', 'Cliente', 'Cliente Email', 'Conductor', 'Conductor Email', 'Precio Final', 'Comisión (10%)', 'Pago Conductor (90%)', 'Fecha Pago', 'Transfer ID', 'Reembolso ID', 'Método Pago']
  const rows = rides.map((r: any) => {
    const c = r.clientId ? profiles.get(r.clientId) : null
    const d = r.driverId ? profiles.get(r.driverId) : null
    return [
      r._id.toString(),
      r.title,
      c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '',
      c?.email || '',
      d ? `${d.firstName || ''} ${d.lastName || ''}`.trim() : '',
      d?.email || '',
      String(r.finalPrice ?? ''),
      String(r.platformFee ?? ''),
      String(r.driverAmount ?? ''),
      r.paidAt ? new Date(r.paidAt).toISOString() : '',
      r.transferId || '',
      r.refundId || '',
      r.stripePaymentMethodId || '',
    ]
  })

  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="pagos.csv"')
  return c.body(toCSV(headers, rows))
})

// Payments dashboard
admin.get('/payments', async (c) => {
  const statusFilter = c.req.query('status')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const search = c.req.query('search')
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20')), 50)

  const query: any = {
    $or: [
      { paymentIntentId: { $exists: true, $ne: null } },
      { transferId: { $exists: true, $ne: null } },
      { refundId: { $exists: true, $ne: null } },
      { status: 'paid' },
    ],
  }

  if (search) {
    query.title = { $regex: search, $options: 'i' }
  }
  if (from || to) {
    query.paidAt = {}
    if (from) query.paidAt.$gte = new Date(from)
    if (to) query.paidAt.$lte = new Date(to)
  }

  const skip = (page - 1) * limit

  const rides = await Ride.find(query).sort({ createdAt: -1 }).lean()

  // Derive payment status and detect discrepancies
  for (const ride of rides) {
    ;(ride as any).paymentStatus = derivePaymentStatus(ride)
    const discrepancies: any[] = []
    if ((ride as any).paymentIntentId && !(ride as any).transferId && (ride as any).status !== 'cancelled') {
      discrepancies.push({ type: 'transfer_pending', severity: 'warning' })
    }
    if ((ride as any).status === 'paid' && !(ride as any).transferId) {
      discrepancies.push({ type: 'transfer_missing', severity: 'critical' })
    }
    if ((ride as any).refundId && (ride as any).status !== 'cancelled') {
      discrepancies.push({ type: 'refund_pending', severity: 'warning' })
    }
    if ((ride as any).status === 'completed' && !(ride as any).paymentIntentId) {
      discrepancies.push({ type: 'payment_missing', severity: 'critical' })
    }
    ;(ride as any).discrepancies = discrepancies
  }

  // Apply derived status filter (post-query since it's computed)
  let filtered = rides
  if (statusFilter && statusFilter !== 'todos') {
    if (statusFilter === 'discrepancy') {
      filtered = filtered.filter((r: any) => r.discrepancies.length > 0)
    } else {
      filtered = filtered.filter((r: any) => r.paymentStatus === statusFilter)
    }
  }

  const total = filtered.length
  const paginated = filtered.slice(skip, skip + limit)

  // Enrich with Clerk profiles
  const clientIds = [...new Set(paginated.map((r: any) => r.clientId).filter(Boolean))] as string[]
  const driverIds = [...new Set(paginated.map((r: any) => r.driverId).filter(Boolean))] as string[]
  const allClerkIds = [...new Set([...clientIds, ...driverIds])]

  let clerkProfiles = new Map<string, any>()
  if (allClerkIds.length > 0) {
    clerkProfiles = await getClerkUserProfiles(allClerkIds)
  }

  const enriched = paginated.map((ride: any) => {
    const clientData = ride.clientId ? clerkProfiles.get(ride.clientId) : null
    const driverData = ride.driverId ? clerkProfiles.get(ride.driverId) : null
    return {
      ...ride,
      client: ride.clientId ? {
        clerkId: ride.clientId,
        firstName: clientData?.firstName || null,
        lastName: clientData?.lastName || null,
        imageUrl: clientData?.imageUrl || null,
        email: clientData?.email || null,
      } : null,
      driver: ride.driverId ? {
        clerkId: ride.driverId,
        firstName: driverData?.firstName || null,
        lastName: driverData?.lastName || null,
        imageUrl: driverData?.imageUrl || null,
      } : null,
    }
  })

  const summary = {
    totalProcessed: total,
    totalRevenue: enriched.reduce((s: number, r: any) => s + (r.finalPrice || 0), 0),
    totalFees: enriched.reduce((s: number, r: any) => s + (r.platformFee || 0), 0),
    totalPendingTransfers: enriched.filter((r: any) =>
      r.discrepancies?.some((d: any) => d.type === 'transfer_pending')
    ).length,
    discrepancyCount: enriched.filter((r: any) => r.discrepancies?.length > 0).length,
  }

  return c.json({
    data: enriched,
    summary,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})

export default admin