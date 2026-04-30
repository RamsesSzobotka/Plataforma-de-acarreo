import { Hono } from 'hono/tiny'
import { getStripeClient, handleStripeWebhookEvent, MarketplaceStripeError } from '../services/stripeMarketplace'

const stripe = getStripeClient()
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

const webhooks = new Hono()

webhooks.post('/stripe', async (c) => {
  try {
    const payload = await c.req.text()
    const signature = c.req.header('stripe-signature')

    if (!signature) {
      return c.json({ error: 'Missing stripe-signature header' }, 400)
    }

    if (!webhookSecret) {
      return c.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, 500)
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    const result = await handleStripeWebhookEvent(event)

    return c.json({ received: true, duplicate: result.duplicate })
  } catch (error: any) {
    if (error instanceof MarketplaceStripeError) {
      return c.json({ error: error.message }, error.statusCode)
    }

    console.error('Stripe webhook error:', error)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

export default webhooks