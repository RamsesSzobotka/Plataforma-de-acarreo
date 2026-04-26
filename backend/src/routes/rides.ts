import { Hono } from 'hono/tiny'
import { Ride } from '../models/ride'

const rides = new Hono()

// Listar rides (con filtros)
rides.get('/', async (c) => {
  const status = c.req.query('status')
  const clientId = c.req.query('clientId')
  const driverId = c.req.query('driverId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '10')
  
  const query: any = {}
  if (status) query.status = status
  if (clientId) query.clientId = clientId
  if (driverId) query.driverId = driverId
  
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

// Crear ride
rides.post('/', async (c) => {
  const body = await c.req.json()
  // TODO: Validar body con Zod
  // TODO: Verificar ownership (auth)
  
  const ride = new Ride(body)
  await ride.save()
  
  return c.json(ride, 201)
})

// Obtener ride por ID
rides.get('/:id', async (c) => {
  const id = c.req.param('id')
  const ride = await Ride.findById(id)
  
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  return c.json(ride)
})

// Actualizar ride
rides.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  // TODO: Verificar ownership del ride
  
  const ride = await Ride.findByIdAndUpdate(id, body, { new: true })
  
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  return c.json(ride)
})

// Cambiar estado del ride
rides.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status, reason } = await c.req.json()
  // TODO: Validar transición de estado
  // TODO: Verificar permisos según estado
  
  const update: any = { status }
  if (reason) update.cancellationReason = reason
  
  const ride = await Ride.findByIdAndUpdate(id, update, { new: true })
  
  return c.json(ride)
})

// Aceptar ride (driver)
rides.post('/:id/accept', async (c) => {
  const id = c.req.param('id')
  const { driverId, agreedPrice } = await c.req.json()
  // TODO: Verificar que el ride está en estado válido
  
  const ride = await Ride.findByIdAndUpdate(id, {
    driverId,
    status: 'accepted',
    finalPrice: agreedPrice,
    chatEnabled: true
  }, { new: true })
  
  return c.json(ride)
})

// Iniciar trackeo (driver confirma carga)
rides.post('/:id/start', async (c) => {
  const id = c.req.param('id')
  const ride = await Ride.findByIdAndUpdate(id, { status: 'in_progress' }, { new: true })
  return c.json(ride)
})

// Subir foto de entrega
rides.post('/:id/delivery-photo', async (c) => {
  const id = c.req.param('id')
  const { url, publicId } = await c.req.json()
  
  const ride = await Ride.findByIdAndUpdate(id, {
    deliveryPhoto: { url, publicId }
  }, { new: true })
  
  return c.json(ride)
})

// Cancelar ride
rides.post('/:id/cancel', async (c) => {
  const id = c.req.param('id')
  const { reason } = await c.req.json()
  // TODO: Verificar permisos según estado actual
  
  const ride = await Ride.findByIdAndUpdate(id, {
    status: 'cancelled',
    cancellationReason: reason
  }, { new: true })
  
  return c.json(ride)
})

export default rides