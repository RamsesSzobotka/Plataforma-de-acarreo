import Stripe from 'stripe'
import { Ride } from '../models/ride'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { ProcessedEvent } from '../models/processedEvent'

let _stripe: Stripe | null = null
const PLATFORM_COMMISSION = 0.10

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(key)
  }
  return _stripe
}

export class MarketplaceStripeError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'MarketplaceStripeError'
    this.statusCode = statusCode
  }
}

export function getStripeClient() {
  return getStripe()
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

  const customer = await getStripe().customers.create({
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
    const paymentMethod = await getStripe().paymentMethods.retrieve(paymentMethodId)
    
    // Si ya está adjunto a este customer, no hacer nada
    if (paymentMethod.customer === customerId) {
      console.log(`✅ PaymentMethod ${paymentMethodId} ya está adjuntado al Customer ${customerId}`)
      return paymentMethod
    }

    // Si está adjunto a otro customer o no está adjunto, adjuntarlo
    if (paymentMethod.customer && paymentMethod.customer !== customerId) {
      console.log(`⚠️ PaymentMethod ${paymentMethodId} está adjuntado a otro customer, será revinculado`)
    }

    console.log(`💳 Adjuntando PaymentMethod ${paymentMethodId} al Customer ${customerId}...`)
    const attachedPaymentMethod = await getStripe().paymentMethods.attach(
      paymentMethodId,
      { customer: customerId }
    )

    console.log(`✅ PaymentMethod ${paymentMethodId} adjuntado exitosamente al Customer ${customerId}`)
    return attachedPaymentMethod
  } catch (error: any) {
    // Si ya está adjunto, ignorar el error
    if (error.message?.includes('already attached')) {
      console.log(`✅ PaymentMethod ${paymentMethodId} ya estaba adjuntado`)
      return await getStripe().paymentMethods.retrieve(paymentMethodId)
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
    console.error(`⚠️ Error adjuntando PaymentMethod en charge: ${attachError.message}`)
    // Continuar de todas formas, Stripe dará un error más específico
  }

  const paymentIntent = await getStripe().paymentIntents.create({
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
    const account = await getStripe().accounts.create({
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

  const accountLink = await getStripe().accountLinks.create({
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
  const account = await getStripe().accounts.retrieve(stripeAccountId)
  console.log({
    payouts_enabled: account.payouts_enabled,
    charges_enabled: account.charges_enabled,
    details_submitted: account.details_submitted,
    requirements: account.requirements,
  })
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
        await Ride.findByIdAndUpdate(rideId, {
          status: 'paid',
          paymentIntentId: paymentIntent.id,
          platformFee: paymentIntent.metadata?.platformFee ? Number(paymentIntent.metadata.platformFee) : undefined,
          driverAmount: paymentIntent.metadata?.driverAmount ? Number(paymentIntent.metadata.driverAmount) : undefined,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
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