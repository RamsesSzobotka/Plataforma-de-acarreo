import { Hono } from 'hono/tiny'
import Stripe from 'stripe'
import { Ride } from '../models/ride'
import { Rating } from '../models/rating'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
const PLATFORM_COMMISSION = 0.10 // 10% para la plataforma

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

  // Validar campos requeridos (stripePaymentMethodId ahora opcional para pruebas)
  const required = ['clientId', 'title', 'description', 'type', 'pickupLocation', 'dropoffLocation', 'estimatedPrice', 'images']
  const missing = required.filter(field => !body[field])
  
  if (missing.length > 0) {
    return c.json({ error: `Campos requeridos faltantes: ${missing.join(', ')}` }, 400)
  }

  // Validar que hay al menos una imagen
  if (!Array.isArray(body.images) || body.images.length === 0) {
    return c.json({ error: 'Se requiere al menos una imagen del pedido' }, 400)
  }

  // Validar máximo 8 imágenes
  if (body.images.length > 8) {
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
      stripePaymentMethodId: body.stripePaymentMethodId || null, // Opcional para pruebas
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
  
  // Obtener el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }

  const update: any = { status }
  if (reason) update.cancellationReason = reason
  
  // LÓGICA: Si el estado cambia a 'completed', automáticamente cobrar
  if (status === 'completed' && ride.stripePaymentMethodId && !ride.paymentIntentId) {
    try {
      console.log(`💳 Cobrando automáticamente al completar ride ${id}...`)
      
      // Obtener el monto a cobrar
      const amount = ride.finalPrice || ride.estimatedPrice
      const amountCents = Math.round(amount * 100) // Stripe usa centavos
      
      // Crear PaymentIntent con el Payment Method guardado
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: undefined, // Sin customer para simplificar
        payment_method: ride.stripePaymentMethodId,
        off_session: true, // Pago sin confirmación del usuario
        confirm: true, // Confirmar inmediatamente
        metadata: {
          rideId: id,
          clientId: ride.clientId,
          conductorAmount: Math.round(amount * (1 - PLATFORM_COMMISSION) * 100).toString(),
          platformAmount: Math.round(amount * PLATFORM_COMMISSION * 100).toString(),
        },
      })
      
      if (paymentIntent.status === 'succeeded') {
        console.log(`✅ Pago exitoso al completar ride ${id}`)
        update.paymentIntentId = paymentIntent.id
        update.paidAt = new Date()
        update.status = 'paid' // Cambiar status directamente a 'paid'
      } else if (paymentIntent.status === 'requires_action') {
        console.warn(`⚠️ Pago requiere acción adicional para ride ${id}`)
        // El pago se quedará en 'completed' esperando acción
      } else if (paymentIntent.status === 'processing') {
        console.log(`⏳ Pago en procesamiento para ride ${id}`)
        update.paymentIntentId = paymentIntent.id
      } else {
        console.error(`❌ Pago fallido al completar ride ${id}: ${paymentIntent.last_payment_error?.message}`)
        return c.json({ 
          error: `Error al procesar el pago automático: ${paymentIntent.last_payment_error?.message || 'Error desconocido'}` 
        }, 402)
      }
    } catch (err) {
      console.error(`❌ Error intentando cobrar automáticamente:`, err)
      // NO retornar error, dejar que el cliente intente pagar manualmente
      console.log(`ℹ️ Ride ${id} se completará, pero requiere pago manual`)
    }
  }

  const updatedRide = await Ride.findByIdAndUpdate(id, update, { new: true })
  
  return c.json(updatedRide)
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

// Confirmar entrega (cliente confirma que recibió la mercancía)
rides.post('/:id/confirm-delivery', async (c) => {
  const id = c.req.param('id')
  const { clientId } = await c.req.json()
  
  // Buscar el ride
  const ride = await Ride.findById(id)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  // Validar que el usuario es el cliente
  if (ride.clientId !== clientId) {
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
  
  if (ride.stripePaymentMethodId && !ride.paymentIntentId) {
    try {
      console.log(`💳 Cobrando automáticamente al confirmar entrega ${id}...`)
      
      const amount = ride.finalPrice || ride.estimatedPrice
      const amountCents = Math.round(amount * 100)
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        payment_method: ride.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          rideId: id,
          clientId: ride.clientId,
          conductorAmount: Math.round(amount * (1 - PLATFORM_COMMISSION) * 100).toString(),
          platformAmount: Math.round(amount * PLATFORM_COMMISSION * 100).toString(),
        },
      })
      
      if (paymentIntent.status === 'succeeded') {
        console.log(`✅ Pago exitoso al confirmar entrega ${id}`)
        update.paymentIntentId = paymentIntent.id
        update.paidAt = new Date()
        update.status = 'paid'
      } else if (paymentIntent.status === 'requires_action') {
        console.warn(`⚠️ Pago requiere acción adicional para ride ${id}`)
        update.paymentIntentId = paymentIntent.id
      }
    } catch (err) {
      console.error(`❌ Error intentando cobrar automáticamente:`, err)
    }
  }
  
  const updatedRide = await Ride.findByIdAndUpdate(id, update, { new: true })
  
  return c.json({
    success: true,
    message: update.status === 'paid' ? 'Entrega confirmada y pago procesado' : 'Entrega confirmada',
    ride: updatedRide
  })
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

// Calificar conductor (cliente) o cliente (conductor)
rides.post('/:id/rate', async (c) => {
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
  
  return c.json(ratingRecord)
})

// Guardar método de pago en el ride
rides.post('/:id/payment-method', async (c) => {
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