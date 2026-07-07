/**
 * Payment service - handles client charging with Stripe
 * Uses capture_method: 'manual' to authorize payment without capturing immediately
 * Capture happens later in confirm-delivery
 */
import { Ride } from '../models/ride'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import Stripe from 'stripe'
import { createAuthorizedPaymentIntent } from './stripeMarketplace'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Charge client when accepting a ride offer
// Creates a PaymentIntent with capture_method: 'manual' to authorize but not capture
export async function chargeClient(
  rideId: string,
  amount: number,
  driverStripeAccountId?: string
): Promise<{ paymentIntentId: string; platformFee: number; driverAmount: number; clientSecret?: string }> {
  const ride = await Ride.findById(rideId)
  if (!ride) {
    throw new Error('Ride not found')
  }

  // Get client to retrieve payment method
  const client = await User.findOne({ clerkId: ride.clientId })
  if (!client) {
    throw new Error('Client not found')
  }

  // Get payment method from client or ride
  const paymentMethodId = client.paymentMethodId || client.stripePaymentMethodId || ride.stripePaymentMethodId
  if (!paymentMethodId) {
    throw new Error('Cliente no tiene método de pago guardado')
  }

  // Get customer ID (create if needed)
  let customerId = client.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: client.email,
      name: [client.firstName, client.lastName].filter(Boolean).join(' ') || undefined,
      metadata: { clerkId: client.clerkId },
    })
    customerId = customer.id
    await User.findByIdAndUpdate(client._id, { stripeCustomerId: customerId })
  }

  const amountInCents = Math.round(amount * 100)

  // Create authorized payment intent (capture_method: 'manual')
  const { paymentIntent, platformFee, driverAmount } = await createAuthorizedPaymentIntent(
    rideId,
    amountInCents,
    paymentMethodId,
    customerId
  )

  return {
    paymentIntentId: paymentIntent.id,
    platformFee,
    driverAmount,
    clientSecret: paymentIntent.client_secret || undefined,
  }
}