/**
 * Payment service - stubs for legacy MCP tools
 * TODO: Implement proper payment flow with Stripe Connect
 */
import { Ride } from '../models/ride'
import { Driver } from '../models/driver'

// Stub for legacy chargeClient function
// New flow uses stripeMarketplace.createMarketplaceCharge with manual capture
export async function chargeClient(
  rideId: string,
  amount: number,
  driverStripeAccountId?: string
): Promise<{ paymentIntentId: string; platformFee: number; driverAmount: number }> {
  const ride = await Ride.findById(rideId)
  if (!ride) {
    throw new Error('Ride not found')
  }

  // Calculate fees (10% platform, 90% driver)
  const amountInCents = Math.round(amount * 100)
  const platformFee = Math.round(amountInCents * 0.10)
  const driverAmount = Math.round(amountInCents * 0.90)

  // For now, return placeholder - actual implementation would create PaymentIntent
  // with capture_method: 'manual' to allow later capture in confirm-delivery
  return {
    paymentIntentId: `pi_stub_${rideId}`,
    platformFee,
    driverAmount,
  }
}