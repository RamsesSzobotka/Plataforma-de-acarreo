import { Hono } from 'hono/tiny'
import Stripe from 'stripe'
import { Ride } from '../models/ride'
import { Driver } from '../models/driver'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
const PLATFORM_COMMISSION = 0.10 // 10% para la plataforma

const payments = new Hono()

// Crear PaymentIntent
payments.post('/create-intent', async (c) => {
  try {
    const body = await c.req.json()
    const { rideId, amount } = body
    
    if (!rideId || !amount) {
      return c.json({ error: 'rideId y amount son requeridos' }, 400)
    }
    
    // Verificar que el ride existe y está en estado correcto
    const ride = await Ride.findById(rideId)
    if (!ride) {
      return c.json({ error: 'Ride no encontrado' }, 404)
    }
    
    if (ride.status !== 'completed') {
      return c.json({ error: 'Ride debe estar en estado completed' }, 400)
    }
    
    // Calcular comisiones
    const amountCents = Math.round(amount * 100) // Stripe usa centavos
    const conductorAmount = Math.round(amount * (1 - PLATFORM_COMMISSION) * 100)
    const platformAmount = Math.round(amount * PLATFORM_COMMISSION * 100)
    
    // Crear PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        rideId,
        conductorAmount: conductorAmount.toString(),
        platformAmount: platformAmount.toString(),
      },
    })
    
    return c.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (err) {
    console.error('Error creating payment intent:', err)
    return c.json({ error: 'Error creando PaymentIntent' }, 500)
  }
})

// Webhook de Stripe - CRÍTICO: Debe verificar firma
payments.post('/webhook', async (c) => {
  try {
    const payload = await c.req.text()
    const signature = c.req.headers.get('stripe-signature')
    
    if (!signature) {
      return c.json({ error: 'Missing stripe-signature header' }, 400)
    }
    
    let event: Stripe.Event
    
    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return c.json({ error: 'Invalid signature' }, 400)
    }
    
    // Procesar eventos de Stripe
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent)
        break
    }
    
    return c.json({ received: true })
  } catch (err) {
    console.error('Error processing webhook:', err)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// Confirmar pago (endpoint para el cliente)
payments.post('/confirm', async (c) => {
  try {
    const { rideId, paymentIntentId } = await c.req.json()
    
    if (!rideId || !paymentIntentId) {
      return c.json({ error: 'rideId y paymentIntentId son requeridos' }, 400)
    }
    
    // Verificar que el ride existe
    const ride = await Ride.findById(rideId)
    if (!ride) {
      return c.json({ error: 'Ride no encontrado' }, 404)
    }
    
    // Verificar PaymentIntent con Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    if (paymentIntent.status !== 'succeeded') {
      return c.json({ error: 'Pago no completado' }, 400)
    }
    
    // El webhook se encargará de actualizar el ride a 'paid'
    // Aquí solo devolvemos confirmación
    return c.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    })
  } catch (err) {
    console.error('Error confirming payment:', err)
    return c.json({ error: 'Error confirmando pago' }, 500)
  }
})

// Crear cuenta Stripe Connect para el conductor
payments.post('/create-connect-account', async (c) => {
  try {
    const userId = c.get('clerkId') || c.req.header('x-user-id')

    if (!userId) {
      return c.json({ error: 'User not authenticated' }, 401)
    }

    const driver = await Driver.findOne({ userId })
    if (!driver) {
      return c.json({ error: 'Driver not found' }, 404)
    }

    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        transfers: { requested: true },
      },
    })

    driver.stripeAccountId = account.id
    await driver.save()

    const origin = process.env.FRONTEND_URL || 'http://localhost:5173'
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/stripe-callback?refresh=true`,
      return_url: `${origin}/stripe-callback?success=true`,
      type: 'account_onboarding',
    })

    return c.json({
      success: true,
      onboardingUrl: accountLink.url,
    })
  } catch (err: any) {
    console.error('Error creating Stripe Connect account:', err)
    return c.json({ error: err.message || 'Error creating connect account' }, 500)
  }
})

// Callback de Stripe Connect
payments.get('/stripe-callback', async (c) => {
  try {
    const success = c.req.query('success')
    const refresh = c.req.query('refresh')

    if (refresh === 'true') {
      return c.json({ success: false, message: 'Onboarding refresh required' })
    }

    if (success === 'true') {
      return c.json({ success: true, message: 'Stripe account connected successfully' })
    }

    return c.json({ success: false, message: 'Unknown callback state' })
  } catch (err: any) {
    console.error('Error in Stripe callback:', err)
    return c.json({ error: err.message }, 500)
  }
})

// Handler para pago exitoso
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const rideId = paymentIntent.metadata?.rideId
  
  if (!rideId) {
    console.error('No rideId in payment intent metadata')
    return
  }
  
  try {
    // Actualizar estado del ride a 'paid'
    const updatedRide = await Ride.findByIdAndUpdate(
      rideId,
      {
        status: 'paid',
        paymentIntentId: paymentIntent.id,
        paidAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    )
    
    if (!updatedRide) {
      console.error('Ride not found:', rideId)
      return
    }
    
    console.log(`✅ Payment confirmed for ride ${rideId}`)
  } catch (err) {
    console.error('Error updating ride after payment:', err)
  }
}

// Handler para pago fallido
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const rideId = paymentIntent.metadata?.rideId
  
  if (!rideId) {
    console.error('No rideId in payment intent metadata')
    return
  }
  
  try {
    // Mantener el ride en estado 'completed' para reintentos
    console.log(`❌ Payment failed for ride ${rideId}`)
    console.error('Last payment error:', paymentIntent.last_payment_error)
  } catch (err) {
    console.error('Error handling payment failure:', err)
  }
}

export default payments