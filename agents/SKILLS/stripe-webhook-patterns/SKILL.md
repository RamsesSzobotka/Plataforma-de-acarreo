---
name: stripe-webhook-patterns
description: >
  Patrones de integración Stripe: PaymentIntents, webhooks idempotentes y cálculo de comisiones.
  Trigger: Cuando se implementa pagos con Stripe, webhooks, o cálculo de comisiones (10%).
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Crear PaymentIntent para procesar pagos
- Manejar webhook de Stripe para confirmar pagos
- Implementar cálculo de comisiones (10% plataforma)
- Configurar idempotencia en operaciones de pago

## Critical Patterns

### 1. Crear PaymentIntent con Comisión

```typescript
// backend/src/services/payment.service.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLATFORM_COMMISSION = 0.10 // 10%

export async function createPaymentIntent(rideId: string, amount: number) {
  // El amount es el precio FINAL acordado
  // El conductor recibe 90%, la plataforma 10%
  
  const conductorAmount = Math.round(amount * (1 - PLATFORM_COMMISSION) * 100) // centavos
  const platformAmount = Math.round(amount * PLATFORM_COMMISSION * 100) // centavos
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount, // en centavos
    currency: 'usd',
    metadata: {
      rideId,
      conductorAmount: conductorAmount.toString(),
      platformAmount: platformAmount.toString(),
    },
    // Transferir automáticamente al conductor después (requiere Connect)
    // transfer_data: {
    //   destination: 'acct_CONDUCTOR_ID',
    // },
  })
  
  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}
```

### 2. Webhook Idempotente

```typescript
// backend/src/routes/payments.ts
import { Hono } from 'hono/tiny'
import Stripe from 'stripe'
import { Ride } from '../models/ride'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const payments = new Hono()

payments.post('/webhook', async (c) => {
  const payload = await c.req.text()
  const headers = c.req.headers()
  const signature = headers.get('stripe-signature')
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature!,
      webhookSecret
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return c.json({ error: 'Invalid signature' }, 400)
  }
  
  // Idempotencia: verificar que no procesamos el mismo evento dos veces
  // Usar el ID del evento para evitar duplicados
  const eventId = event.id
  
  // TODO: Implementar tabla de eventos procesados
  // if (await isEventProcessed(eventId)) {
  //   return c.json({ received: true, duplicate: true })
  // }
  
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent)
        break
    }
    
    // Marcar evento como procesado
    // await markEventProcessed(eventId)
    
    return c.json({ received: true })
  } catch (err) {
    console.error('Error processing webhook:', err)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})
```

### 3. Confirmar Pago y Actualizar Ride

```typescript
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const rideId = paymentIntent.metadata?.rideId
  
  if (!rideId) {
    console.error('No rideId in payment intent metadata')
    return
  }
  
  // Actualizar estado del ride a 'paid'
  const ride = await Ride.findByIdAndUpdate(
    rideId,
    {
      status: 'paid',
      paymentIntentId: paymentIntent.id,
      paidAt: new Date(),
      updatedAt: new Date()
    },
    { new: true }
  )
  
  if (!ride) {
    console.error('Ride not found:', rideId)
    return
  }
  
  // TODO: Si usas Stripe Connect, crear la transferencia al conductor
  // const conductorAmount = paymentIntent.metadata?.conductorAmount
  // await stripe.transfers.create({
  //   amount: conductorAmount,
  //   currency: 'usd',
  //   destination: 'acct_CONDUCTOR_STRIPE_ID',
  //   transfer_group: rideId,
  // })
  
  console.log(`Payment confirmed for ride ${rideId}`)
}
```

### 4. Endpoint para Cliente Confirmar Pago

```typescript
// backend/src/routes/payments.ts

payments.post('/confirm', async (c) => {
  const { rideId, paymentIntentId } = await c.req.json()
  
  // Verificar que el ride existe y está en estado correcto
  const ride = await Ride.findById(rideId)
  
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  if (ride.status !== 'completed') {
    return c.json({ error: 'Ride debe estar en estado completed' }, 400)
  }
  
  // Verificar PaymentIntent con Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  
  if (paymentIntent.status !== 'succeeded') {
    return c.json({ error: 'Pago no completado' }, 400)
  }
  
  // El webhook se encargará de actualizar el ride
  // Aquí solo devolvemos confirmación al frontend
  return c.json({
    success: true,
    paymentIntentId: paymentIntent.id,
  })
})
```

## Code Examples

### Frontend: Confirmar Pago con Stripe Elements

```typescript
// frontend/src/pages/RideDetails.tsx
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!)

function PaymentForm({ rideId, amount }: { rideId: string; amount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!stripe || !elements) return
    
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Redirect automático después del pago
        return_url: `${window.location.origin}/ride/${rideId}/success`,
      },
    })
    
    if (error) {
      console.error(error)
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe}>
        Pagar ${amount}
      </button>
    </form>
  )
}
```

## Commands

```bash
# Iniciar Stripe CLI para webhooks locales
stripe listen --forward-to localhost:3000/api/payments/webhook

# Probar webhook manualmente
stripe trigger payment_intent.succeeded

# Ver logs de Stripe CLI
stripe logs tail
```

## Resources

- **Templates**: Ver [assets/stripe-webhook-handler.ts](assets/stripe-webhook-handler.ts)
- **Documentación**: [Stripe Webhooks](https://stripe.com/docs/webhooks)