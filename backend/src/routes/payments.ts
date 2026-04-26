import { Hono } from 'hono/tiny'

const payments = new Hono()

// Crear PaymentIntent
payments.post('/create-intent', async (c) => {
  const body = await c.req.json()
  const { rideId, amount, currency = 'usd' } = body
  
  // TODO: Implementar con Stripe
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  // const paymentIntent = await stripe.paymentIntents.create({
  //   amount: amount * 100, // Stripe usa centavos
  //   currency,
  //   metadata: { rideId }
  // })
  
  return c.json({
    message: 'Stripe integration TODO',
    // clientSecret: paymentIntent.client_secret
  })
})

// Webhook de Stripe
payments.post('/webhook', async (c) => {
  const body = await c.req.json()
  
  // TODO: Verificar firma del webhook
  // TODO: Actualizar estado del ride a 'paid'
  
  return c.json({ received: true })
})

// Confirmar pago (endpoint para el cliente)
payments.post('/confirm', async (c) => {
  const { rideId, paymentIntentId } = await c.req.json()
  
  // TODO: Verificar PaymentIntent con Stripe
  // TODO: Actualizar ride a 'paid'
  
  return c.json({ message: 'Payment confirmed - TODO' })
})

export default payments