import Stripe from 'stripe'
import { Ride } from '../models/ride'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { ProcessedEvent } from '../models/processedEvent'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
const PLATFORM_COMMISSION = 0.10

export class MarketplaceStripeError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'MarketplaceStripeError'
    this.statusCode = statusCode
  }
}

export function getStripeClient() {
  return stripe
}

export function calculateMarketplaceAmounts(amountInCents: number) {
  const platformFee = Math.round(amountInCents * PLATFORM_COMMISSION)
  const driverAmount = amountInCents - platformFee

  return { platformFee, driverAmount }
}

async function ensureStripeCustomer(user: any) {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId as string
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    metadata: { clerkId: user.clerkId },
  }, {
    idempotencyKey: `customer:${user.clerkId}`,
  })

  await User.findOneAndUpdate(
    { clerkId: user.clerkId },
    { stripeCustomerId: customer.id, updatedAt: new Date() },
    { new: true }
  )

  return customer.id
}

async function ensurePaymentMethodAttached(paymentMethodId: string, customerId: string) {
  try {
    // Intentar recuperar el PaymentMethod
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    
    // Si ya está adjunto a este customer, no hacer nada
    if (paymentMethod.customer === customerId) {
      return paymentMethod
    }

    // Si está adjunto a otro customer o no está adjunto, adjuntarlo
    if (paymentMethod.customer && paymentMethod.customer !== customerId) {
      console.debug(`PaymentMethod ${paymentMethodId} está adjuntado a otro customer, será revinculado`)
    }

    const attachedPaymentMethod = await stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId }
    )

    return attachedPaymentMethod
  } catch (error: any) {
    // Si ya está adjunto, ignorar el error
    if (error.message?.includes('already attached')) {
      return await stripe.paymentMethods.retrieve(paymentMethodId)
    }
    throw error
  }
}

export async function createMarketplaceCharge(rideId: string, options?: { skipStatusCheck?: boolean }) {
  const ride = await Ride.findById(rideId)
  if (!ride) {
    throw new MarketplaceStripeError('Ride no encontrado', 404)
  }

  if (!ride.driverId) {
    throw new MarketplaceStripeError('El ride no tiene conductor asignado', 400)
  }

  if (!options?.skipStatusCheck && ride.status !== 'completed') {
    throw new MarketplaceStripeError('Ride debe estar en estado completed', 400)
  }

  const client = await User.findOne({ clerkId: ride.clientId })
  if (!client) {
    throw new MarketplaceStripeError('Cliente no encontrado', 404)
  }

  const driver = await Driver.findOne({ userId: ride.driverId })
  if (!driver) {
    throw new MarketplaceStripeError('Conductor no encontrado', 404)
  }

  if (!driver.stripeAccountId) {
    throw new MarketplaceStripeError('El conductor no tiene cuenta Stripe Connect activa', 400)
  }



  const paymentMethodId = client.paymentMethodId || client.stripePaymentMethodId || ride.stripePaymentMethodId
  if (!paymentMethodId) {
    throw new MarketplaceStripeError('El cliente no tiene método de pago guardado', 400)
  }

  const customerId = await ensureStripeCustomer(client)
  const amountInCents = Math.round((ride.finalPrice || ride.estimatedPrice) * 100)
  const { platformFee, driverAmount } = calculateMarketplaceAmounts(amountInCents)

  // Asegurar que el PaymentMethod está adjunto al Customer (fallback)
  try {
    await ensurePaymentMethodAttached(paymentMethodId, customerId)
  } catch (attachError: any) {
    // Continuar de todas formas, Stripe dará un error más específico
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    off_session: true,
    application_fee_amount: platformFee,
    transfer_data: { destination: driver.stripeAccountId },
    metadata: {
      rideId: rideId.toString(),
      clientId: ride.clientId,
      driverId: ride.driverId,
      platformFee: platformFee.toString(),
      driverAmount: driverAmount.toString(),
      paymentMethodId,
      customerId,
    },
  }, {
    idempotencyKey: `ride:${rideId}:charge`,
  })

  await Ride.findByIdAndUpdate(
    rideId,
    {
      paymentIntentId: paymentIntent.id,
      platformFee,
      driverAmount,
      stripePaymentMethodId: paymentMethodId,
      updatedAt: new Date(),
    },
    { new: true }
  )

  return { paymentIntent, platformFee, driverAmount, customerId, paymentMethodId }
}

export async function createDriverConnectAccount(params: { clerkId: string; email: string; origin: string }) {
  const driver = await Driver.findOne({ userId: params.clerkId })
  if (!driver) {
    throw new MarketplaceStripeError('Driver not found', 404)
  }

  if (!driver.stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'PA',
      email: params.email,
      capabilities: {
        transfers: { requested: true },
      },
      tos_acceptance: {
        service_agreement: 'recipient',
      },
      metadata: { clerkId: params.clerkId },
    })

    driver.stripeAccountId = account.id
    driver.payoutsEnabled = !!account.payouts_enabled
    await driver.save()
  }

  const accountLink = await stripe.accountLinks.create({
    account: driver.stripeAccountId,
    refresh_url: `${params.origin}/driver/payments?refresh=1`,
    return_url: `${params.origin}/driver/payments?connected=1`,
    type: 'account_onboarding',
  })

  return {
    onboardingUrl: accountLink.url,
    stripeAccountId: driver.stripeAccountId,
  }
}

export async function refreshDriverPayoutStatus(stripeAccountId: string) {
  const account = await stripe.accounts.retrieve(stripeAccountId)
  const driver = await Driver.findOneAndUpdate(
    { stripeAccountId },
    { payoutsEnabled: !!account.payouts_enabled, updatedAt: new Date() },
    { new: true }
  )

  if (!driver) {
    throw new MarketplaceStripeError('Driver not found', 404)
  }

  return {
    stripeAccountId,
    payoutsEnabled: !!account.payouts_enabled,
    chargesEnabled: !!account.charges_enabled,
    detailsSubmitted: !!account.details_submitted,
  }
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const alreadyProcessed = await ProcessedEvent.findOne({ eventId: event.id })
  if (alreadyProcessed) {
    return { duplicate: true }
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const rideId = paymentIntent.metadata?.rideId
      if (rideId) {
        const ride = await Ride.findByIdAndUpdate(rideId, {
          status: 'paid',
          paymentIntentId: paymentIntent.id,
          platformFee: paymentIntent.metadata?.platformFee ? Number(paymentIntent.metadata.platformFee) : undefined,
          driverAmount: paymentIntent.metadata?.driverAmount ? Number(paymentIntent.metadata.driverAmount) : undefined,
          paidAt: new Date(),
          updatedAt: new Date(),
        }, { new: true })

        // Notify driver via email that payment was received
        if (ride?.driverId) {
          const { sendEmail, getUserEmail, paymentReceivedEmail } = await import('./notifications/email')
          const driverEmail = await getUserEmail(ride.driverId)
          if (driverEmail) {
            const amount = ride.finalPrice || Number(paymentIntent.amount) / 100
            const emailContent = paymentReceivedEmail(driverEmail, amount, {
              rideId: ride._id.toString(),
              title: ride.title,
              pickupAddress: ride.pickupLocation.address,
              dropoffAddress: ride.dropoffLocation.address,
              finalPrice: amount,
            })
            console.log(`[Email] Sending payment notification to driver: ${driverEmail} for ride: ${ride._id}`)
            sendEmail(emailContent)
              .then(() => console.log(`[Email] Payment notification sent to: ${driverEmail}`))
              .catch(err => console.error(`[Email] Failed to send payment notification: ${err}`))
          } else {
            console.warn(`[Email] Cannot send payment notification - no email found for driver: ${ride.driverId}`)
          }
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const rideId = paymentIntent.metadata?.rideId
      if (rideId) {
        await Ride.findByIdAndUpdate(rideId, {
          status: 'failed',
          paymentIntentId: paymentIntent.id,
          updatedAt: new Date(),
        })
      }
      break
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      if (account.id) {
        await Driver.findOneAndUpdate(
          { stripeAccountId: account.id },
          { payoutsEnabled: !!account.payouts_enabled, updatedAt: new Date() },
          { new: true }
        )
      }
      break
    }

    case 'payout.paid':
      break

    default:
      break
  }

  await ProcessedEvent.create({
    eventId: event.id,
    eventType: event.type,
    processedAt: new Date(),
    payload: event.data.object,
  })

  return { duplicate: false }
}