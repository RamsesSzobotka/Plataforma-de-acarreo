import { Hono } from 'hono/tiny'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'

const users = new Hono()

// Listar usuarios (solo admin)
users.get('/', async (c) => {
  const role = c.req.query('role')
  const query = role ? { role } : {}
  
  const usersList = await User.find(query).sort({ createdAt: -1 })
  return c.json({ data: usersList })
})

// Obtener usuario por ID de Clerk (con rating y totalRides)
users.get('/:clerkId', async (c) => {
  const clerkId = c.req.param('clerkId')
  const user = await User.findOne({ clerkId })
  
  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }
  
  // Calcular rating promedio desde la coleccion de ratings
  // TODO: Implementar cuando ratings este listo
  const averageRating = 0
  const totalRides = 0
  
  return c.json({
    ...user.toObject(),
    averageRating,
    totalRides,
  })
})

// Crear/actualizar usuario (desde webhook de Clerk)
users.post('/', async (c) => {
  const body = await c.req.json()
  
  const user = await User.findOneAndUpdate(
    { clerkId: body.clerkId },
    { ...body, updatedAt: new Date() },
    { upsert: true, new: true }
  )
  
  return c.json(user)
})

// Registrar como driver - CON VALIDACION
users.post('/register-driver', authMiddleware, async (c) => {
  const currentUser = c.get('user') as AuthUser
  const body = await c.req.json()
  
  const { 
    vehicleType, 
    plate, 
    capacityKg,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    vehicleColor
  } = body
  
  // Validaciones
  if (!vehicleType || !plate || !capacityKg) {
    return c.json({ error: 'vehicleType, plate y capacityKg son requeridos' }, 400)
  }
  
  // Validar vehicleType
  const validTypes = ['camioneta', 'camion', 'furgon', 'grua', 'otro']
  if (!validTypes.includes(vehicleType)) {
    return c.json({ error: `vehicleType debe ser uno de: ${validTypes.join(', ')}` }, 400)
  }
  
  // Validar capacidad
  if (capacityKg < 1 || capacityKg > 50000) {
    return c.json({ error: 'capacityKg debe estar entre 1 y 50000' }, 400)
  }
  
  // Normalizar placa (formato: ABC-1234)
  const normalizedPlate = plate.toUpperCase().replace(/\s+/g, '').replace(/([A-Z]{3})([0-9]{4})/, '$1-$2')
  const plateRegex = /^[A-Z]{3}-?[0-9]{3,4}$/
  if (!plateRegex.test(normalizedPlate)) {
    return c.json({ error: 'Formato de placa invalido. Ejemplo: ABC-1234' }, 400)
  }
  
  // Verificar que el usuario existe y no es driver ya
  const user = await User.findOne({ clerkId: currentUser.clerkId })
  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }
  
  if (user.role === 'driver') {
    return c.json({ error: 'Ya eres conductor registrado' }, 400)
  }
  
  // Verificar que no existe otro driver con la misma placa
  const existingDriver = await Driver.findOne({ plate: normalizedPlate })
  if (existingDriver) {
    return c.json({ error: 'Ya existe un conductor con esta placa' }, 400)
  }
  
  // Actualizar rol a driver
  await User.findOneAndUpdate(
    { clerkId: currentUser.clerkId },
    { role: 'driver', updatedAt: new Date() }
  )
  
  // Crear ficha de driver
  const driver = await Driver.findOneAndUpdate(
    { userId: currentUser.clerkId },
    { 
      vehicleType,
      plate: normalizedPlate,
      capacityKg,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      isAvailable: false,
      isVerified: false,
      rating: 0,
      totalRides: 0,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  )
  
  return c.json({
    success: true,
    message: 'Registro como conductor exitoso',
    driver: {
      _id: driver._id,
      vehicleType: driver.vehicleType,
      plate: driver.plate,
      capacityKg: driver.capacityKg,
      isAvailable: driver.isAvailable,
    }
  })
})

// Obtener perfil de driver
users.get('/driver/:userId', async (c) => {
  const userId = c.req.param('userId')
  
  const driver = await Driver.findOne({ userId })
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  const user = await User.findOne({ clerkId: userId })
  
  return c.json({
    ...driver.toObject(),
    user: user ? {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      imageUrl: user.imageUrl,
    } : null
  })
})

// Actualizar disponibilidad de driver
users.patch('/driver/:userId/availability', async (c) => {
  const userId = c.req.param('userId')
  const { isAvailable } = await c.req.json()
  
  const driver = await Driver.findOneAndUpdate(
    { userId },
    { isAvailable, updatedAt: new Date() },
    { new: true }
  )
  
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  return c.json(driver)
})

// Actualizar ubicacion de driver
users.patch('/driver/:userId/location', async (c) => {
  const userId = c.req.param('userId')
  const { coordinates } = await c.req.json()
  
  const driver = await Driver.findOneAndUpdate(
    { userId },
    { currentLocation: { type: 'Point', coordinates }, updatedAt: new Date() },
    { new: true }
  )
  
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  return c.json(driver)
})

export default users