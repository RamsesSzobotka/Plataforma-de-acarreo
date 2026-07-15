import { Hono } from 'hono/tiny'
import { getDebugMode } from '../utils/debugLogger'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { Ride } from '../models/ride'
import {
  createDriverConnectAccount,
  createMarketplaceCharge,
  getStripeClient,
  MarketplaceStripeError,
  refreshDriverPayoutStatus,
} from '../services/stripeMarketplace'
import { logAudit } from '../services/audit'

const stripe = getStripeClient()

const payments = new Hono()

payments.post('/setup-intent', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser
    const user = await User.findOne({ clerkId: currentUser.clerkId })

    if (!user) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }

    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
        metadata: { clerkId: currentUser.clerkId },
      }, {
        idempotencyKey: `customer:${currentUser.clerkId}`,
      })

      customerId = customer.id

      await User.findOneAndUpdate(
        { clerkId: currentUser.clerkId },
        { stripeCustomerId: customerId, updatedAt: new Date() },
        { new: true }
      )
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      usage: 'off_session',
      metadata: { clerkId: currentUser.clerkId },
    }, {
      idempotencyKey: `setup-intent:${currentUser.clerkId}:${Date.now()}`,
    })

    // Audit
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    logAudit({
      action: 'payment.setup_intent',
      entityType: 'user',
      entityId: currentUser.clerkId || 'unknown',
      userId: currentUser.clerkId || null,
      userRole: currentUser.role || undefined,
      details: { setupIntentId: setupIntent.id },
      ip,
      userAgent,
    })

    return c.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      stripeCustomerId: customerId,
    })
  } catch (error) {
    console.error('Error creating setup intent:', error)
    return c.json({ error: 'Error creando SetupIntent' }, 500)
  }
})

payments.post('/charge', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser
    const body = await c.req.json()
    const rideId = String(body.rideId || body.id || '')

    if (!rideId) {
      return c.json({ error: 'rideId es requerido' }, 400)
    }

    const result = await createMarketplaceCharge(rideId)

    if (getDebugMode()) console.log(`[Payments] 💰 Payment captured — rideId: ${rideId}, paymentIntent: ${result.paymentIntent.id}, amount: $${(result.paymentIntent.amount || 0) / 100}`)

    // Audit
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    logAudit({
      action: 'payment.charge',
      entityType: 'ride',
      entityId: body.rideId || 'unknown',
      userId: currentUser?.clerkId || null,
      userRole: currentUser?.role || undefined,
      details: { status: result.paymentIntent.status },
      ip,
      userAgent,
    })

    return c.json({
      success: true,
      paymentIntentId: result.paymentIntent.id,
      status: result.paymentIntent.status,
      clientSecret: result.paymentIntent.client_secret,
      platformFee: result.platformFee,
      driverAmount: result.driverAmount,
      customerId: result.customerId,
      paymentMethodId: result.paymentMethodId,
    })
  } catch (error: any) {
    if (error instanceof MarketplaceStripeError) {
      return c.json({ error: error.message }, error.statusCode)
    }

    console.error('Error creating marketplace charge:', error)
    return c.json({ error: 'Error creando el cobro con Stripe Connect' }, 500)
  }
})

payments.post('/create-intent', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser
    const body = await c.req.json()
    const result = await createMarketplaceCharge(String(body.rideId))

    if (getDebugMode()) console.log(`[Payments] ✅ PaymentIntent ${result.paymentIntent.id} created — amount: $${(result.paymentIntent.amount || 0) / 100}, client: ${currentUser.clerkId}`)

    // Audit
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    logAudit({
      action: 'payment.create_intent',
      entityType: 'ride',
      entityId: body.rideId || 'unknown',
      userId: currentUser?.clerkId || null,
      userRole: currentUser?.role || undefined,
      ip,
      userAgent,
    })

    return c.json({
      clientSecret: result.paymentIntent.client_secret,
      paymentIntentId: result.paymentIntent.id,
      status: result.paymentIntent.status,
      platformFee: result.platformFee,
      driverAmount: result.driverAmount,
    })
  } catch (error: any) {
    if (error instanceof MarketplaceStripeError) {
      return c.json({ error: error.message }, error.statusCode)
    }

    console.error('Error creating legacy payment intent:', error)
    return c.json({ error: 'Error creando PaymentIntent' }, 500)
  }
})

payments.post('/attach-payment-method', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser
    const body = await c.req.json()
    const { paymentMethodId, setupIntentId } = body

    if (!paymentMethodId || !setupIntentId) {
      return c.json({ error: 'paymentMethodId y setupIntentId son requeridos' }, 400)
    }

    // Obtener usuario
    const user = await User.findOne({ clerkId: currentUser.clerkId })
    if (!user) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }

    // Validar que el setupIntent pertenece a este usuario
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
    if (!setupIntent || setupIntent.metadata?.clerkId !== currentUser.clerkId) {
      return c.json({ error: 'SetupIntent no válido para este usuario' }, 403)
    }

    // Asegurar que existe un customer
    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
        metadata: { clerkId: currentUser.clerkId },
      }, {
        idempotencyKey: `customer:${currentUser.clerkId}`,
      })
      customerId = customer.id
      await User.findOneAndUpdate(
        { clerkId: currentUser.clerkId },
        { stripeCustomerId: customerId, updatedAt: new Date() },
        { new: true }
      )
    }

    // Adjuntar el payment method al customer
    console.log(`💳 Adjuntando PaymentMethod ${paymentMethodId} al Customer ${customerId}...`)
    const attachedPaymentMethod = await stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId }
    )

    console.log(`✅ PaymentMethod ${paymentMethodId} adjuntado al Customer ${customerId}`)

    // Audit
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    logAudit({
      action: 'payment.attach_method',
      entityType: 'user',
      entityId: currentUser.clerkId || 'unknown',
      userId: currentUser.clerkId || null,
      userRole: currentUser.role || undefined,
      ip,
      userAgent,
    })

    return c.json({
      success: true,
      paymentMethodId: attachedPaymentMethod.id,
      customerId,
      last4: attachedPaymentMethod.card?.last4,
      brand: attachedPaymentMethod.card?.brand,
    })
  } catch (error: any) {
    console.error('❌ Error adjuntando PaymentMethod:', error.message)
    
    // Ignorar error si el PaymentMethod ya está adjunto
    if (error.message?.includes('already attached')) {
      return c.json({
        success: true,
        message: 'PaymentMethod ya estaba adjuntado',
      })
    }

    return c.json({ error: `Error adjuntando método de pago: ${error.message}` }, 400)
  }
})

payments.post('/confirm', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser
    const { rideId, paymentIntentId } = await c.req.json()

    if (!rideId || !paymentIntentId) {
      return c.json({ error: 'rideId y paymentIntentId son requeridos' }, 400)
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return c.json({ error: 'Pago no completado' }, 400)
    }

    // Audit
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    logAudit({
      action: 'payment.confirm',
      entityType: 'ride',
      entityId: rideId || 'unknown',
      userId: currentUser?.clerkId || null,
      userRole: currentUser?.role || undefined,
      ip,
      userAgent,
    })

    return c.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    })
  } catch (error) {
    console.error('Error confirming payment:', error)
    return c.json({ error: 'Error confirmando pago' }, 500)
  }
})

payments.post('/connect/create-account', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser

    if (currentUser.role !== 'driver' && currentUser.role !== 'admin') {
      return c.json({ error: 'Solo conductores pueden activar cuentas de pagos' }, 403)
    }

    const origin = process.env.FRONTEND_URL || 'http://localhost:5173'
    const account = await createDriverConnectAccount({
      clerkId: currentUser.clerkId,
      email: currentUser.email,
      origin,
    })

    // Audit
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    logAudit({
      action: 'payment.connect_account',
      entityType: 'driver',
      entityId: currentUser.clerkId || 'unknown',
      userId: currentUser.clerkId || null,
      userRole: currentUser.role || undefined,
      details: { stripeAccountId: account.stripeAccountId },
      ip,
      userAgent,
    })

    if (getDebugMode()) console.log(`[Payments] 🏦 Connect account created — driverId: ${currentUser.clerkId}, accountId: ${account.stripeAccountId}`)

    return c.json({
      success: true,
      onboardingUrl: account.onboardingUrl,
      stripeAccountId: account.stripeAccountId,
    })
  } catch (error: any) {
    if (error instanceof MarketplaceStripeError) {
      return c.json({ error: error.message }, error.statusCode)
    }

    console.error('Error creating Stripe Connect account:', error)
    return c.json({ error: 'Error creando cuenta Stripe Connect' }, 500)
  }
})

payments.get('/connect/status', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser
    const driver = await Driver.findOne({ userId: currentUser.clerkId })

    if (!driver) {
      return c.json({ error: 'Driver not found' }, 404)
    }

    if (!driver.stripeAccountId) {
      return c.json({
        stripeAccountId: null,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
      })
    }

    const status = await refreshDriverPayoutStatus(driver.stripeAccountId)
    return c.json(status)
  } catch (error: any) {
    if (error instanceof MarketplaceStripeError) {
      return c.json({ error: error.message }, error.statusCode)
    }

    console.error('Error retrieving connect status:', error)
    return c.json({ error: 'Error consultando el estado de Stripe Connect' }, 500)
  }
})

payments.get('/stripe-callback', async (c) => {
  const success = c.req.query('success')
  const refresh = c.req.query('refresh')

  if (refresh === 'true') {
    return c.json({ success: false, message: 'Onboarding refresh required' })
  }

  if (success === 'true') {
    return c.json({ success: true, message: 'Stripe account connected successfully' })
  }

  return c.json({ success: false, message: 'Unknown callback state' })
})

payments.get('/history', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user') as AuthUser

    if (currentUser.role !== 'driver' && currentUser.role !== 'admin') {
      return c.json({ error: 'Solo conductores pueden ver historial de pagos' }, 403)
    }

    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    const query = {
      driverId: currentUser.clerkId,
      status: 'paid'
    }

    const skip = (page - 1) * limit

    const [rides, total] = await Promise.all([
      Ride.find(query)
        .select('title finalPrice driverAmount platformFee paidAt pickupLocation dropoffLocation createdAt')
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit),
      Ride.countDocuments(query)
    ])

    const summary = await Ride.aggregate([
      { $match: { driverId: currentUser.clerkId, status: 'paid' } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$driverAmount' },
          totalRides: { $sum: 1 }
        }
      }
    ])

    return c.json({
      data: rides,
      summary: {
        totalEarnings: summary[0]?.totalEarnings || 0,
        totalRides: summary[0]?.totalRides || 0
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
  } catch (error: any) {
    console.error('Error fetching payment history:', error)
    return c.json({ error: 'Error obteniendo historial de pagos' }, 500)
  }
})

export default payments