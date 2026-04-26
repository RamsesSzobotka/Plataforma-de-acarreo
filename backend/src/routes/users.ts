import { Hono } from 'hono/tiny'
import { User } from '../models/user'
import { Driver } from '../models/driver'

const users = new Hono()

// Listar usuarios (solo admin)
users.get('/', async (c) => {
  // TODO: Verificar que es admin
  const role = c.req.query('role')
  const query = role ? { role } : {}
  
  const usersList = await User.find(query).sort({ createdAt: -1 })
  return c.json({ data: usersList })
})

// Obtener usuario por ID de Clerk
users.get('/:clerkId', async (c) => {
  const clerkId = c.req.param('clerkId')
  const user = await User.findOne({ clerkId })
  
  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }
  
  return c.json(user)
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

// Registrar como driver
users.post('/register-driver', async (c) => {
  const body = await c.req.json()
  const { userId, vehicleType, plate, capacityKg } = body
  
  // Verificar que el usuario existe
  const user = await User.findOne({ clerkId: userId })
  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }
  
  // Actualizar rol a driver
  await User.findOneAndUpdate({ clerkId: userId }, { role: 'driver' })
  
  // Crear/ficha de driver
  const driver = await Driver.findOneAndUpdate(
    { userId },
    { vehicleType, plate, capacityKg },
    { upsert: true, new: true }
  )
  
  return c.json(driver)
})

// Obtener perfil de driver
users.get('/driver/:userId', async (c) => {
  const userId = c.req.param('userId')
  const driver = await Driver.findOne({ userId })
  
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  return c.json(driver)
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
  
  return c.json(driver)
})

// Actualizar ubicación de driver
users.patch('/driver/:userId/location', async (c) => {
  const userId = c.req.param('userId')
  const { coordinates } = await c.req.json()
  
  const driver = await Driver.findOneAndUpdate(
    { userId },
    { currentLocation: { type: 'Point', coordinates }, updatedAt: new Date() },
    { new: true }
  )
  
  return c.json(driver)
})

export default users