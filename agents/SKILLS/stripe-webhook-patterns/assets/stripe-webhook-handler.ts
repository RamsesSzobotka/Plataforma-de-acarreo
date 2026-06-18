/**
 * Stripe Webhook Handler Template
 * 
 * Usage: Copiar a src/routes/payments.ts y completar las funciones
 */

import { Hono } from 'hono/tiny'
import Stripe from 'stripe'
import { Ride } from '../models/ride'

// Placeholder para tu servicio de eventos procesados (idempotencia)
// import { ProcessedEvent } from '../models/processed-event'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const payments = new Hono()

/**
 * Webhook endpoint para Stripe
 * Configurar en Stripe Dashboard > Webhooks
 * 
 * Importante: Usar text() para obtener el body raw, no json()
 */
payments.post('/webhook', async (c) => {
  const payload = await c.req.text()
  const headers = c.req.headers()
  const signature = headers.get('stripe-signature')
  
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400)
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
  
  // === IDEMPOTENCIA ===
  // Verificar que no procesamos el mismo evento dos veces
  // Descomentar cuando tengas la colección de eventos procesados
  // 
  // const isProcessed = await ProcessedEvent.findOne({ eventId: event.id })
  // if (isProcessed) {
  //   console.log(`Evento ya procesado: ${event.id}`)
  //   return c.json({ received: true, duplicate: true })
  // }
  
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
        
      default:
        console.log(`Evento no manejado: ${event.type}`)
    }
    
    // === MARCAR COMO PROCESADO ===
    // Descomentar cuando tengas la colección de eventos procesados
    // await ProcessedEvent.create({ eventId: event.id, processedAt: new Date() })
    
    return c.json({ received: true })
  } catch (err) {
    console.error('Error processing webhook:', err)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

/**
 * Payment succeeded - Actualizar ride a 'paid'
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const rideId = paymentIntent.metadata?.rideId
  
  if (!rideId) {
    console.error('No rideId in payment intent metadata')
    return
  }
  
  console.log(`Payment succeeded for ride: ${rideId}`)
  
  // Actualizar estado del ride
  const ride = await Ride.findByIdAndUpdate(
    rideId,
    {
      status: 'paid',
      // paymentIntentId: paymentIntent.id, // Descomentar si agregas este campo
      updatedAt: new Date()
    },
    { new: true }
  )
  
  if (!ride) {
    console.error('Ride not found:', rideId)
    return
  }
  
  // TODO: Si usas Stripe Connect para pagar al conductor:
  // const conductorAmount = parseInt(paymentIntent.metadata?.conductorAmount || '0')
  // if (ride.driverId) {
  //   const driver = await Driver.findOne({ userId: ride.driverId })
  //   if (driver?.stripeAccountId) {
  //     await stripe.transfers.create({
  //       amount: conductorAmount,
  //       currency: 'usd',
  //       destination: driver.stripeAccountId,
  //       transfer_group: rideId,
  //     })
  //   }
  // }
  
  console.log(`Ride ${rideId} marked as paid`)
}

/**
 * Payment failed - Manejar fallo de pago
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const rideId = paymentIntent.metadata?.rideId
  
  console.log(`Payment failed for ride: ${rideId}`)
  
  // TODO: Notificar al cliente, perhaps cambiar estado del ride
  // await Ride.findByIdAndUpdate(rideId, { paymentFailed: true })
}

/**
 * Charge refunded - Manejar reembolso
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log(`Charge refunded: ${charge.id}`)
  
  // TODO: Actualizar ride si es necesario
  // TODO: Notificar a ambas partes
}

export default payments