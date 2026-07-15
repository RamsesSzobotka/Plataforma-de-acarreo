/**
 * Centralized helper: sends email to relevant parties when ride status changes.
 * Checks each user's emailPreferences before sending. Fire-and-forget (logs errors, doesn't throw).
 */

import { User } from '../../models/user'
import { sendEmail } from './email'
import { rideAcceptedEmail, rideInProgressEmail, rideCompletedPaidEmail, rideCancelledEmail } from './templates'

interface StatusEmailParams {
  ride: any           // Ride document
  oldStatus: string
  newStatus: string
  cancelledBy?: string   // clerkId of who cancelled (for cancel emails)
  cancellationReason?: string
}

/**
 * Centralized helper: sends email to relevant parties when ride status changes.
 * Checks each user's emailPreferences before sending. Fire-and-forget (logs errors, doesn't throw).
 */
export async function sendRideStatusEmail(params: StatusEmailParams): Promise<void> {
  const { ride, newStatus, cancelledBy, cancellationReason } = params

  // Build ride details for templates
  const rideDetails = {
    rideId: ride._id.toString(),
    title: ride.title,
    pickupAddress: ride.pickupLocation?.address || '',
    dropoffAddress: ride.dropoffLocation?.address || '',
    finalPrice: ride.finalPrice || ride.estimatedPrice,
  }

  try {
    switch (newStatus) {
      case 'accepted': {
        // Notify client that a driver accepted
        if (ride.clientId) {
          const user = await User.findOne({ clerkId: ride.clientId }).select('emailPreferences email').lean()
          if (user?.email && user?.emailPreferences?.onAccepted !== false) {
            const email = rideAcceptedEmail(user.email, rideDetails)
            await sendEmail(email)
          }
        }
        break
      }

      case 'in_progress': {
        // Notify client that trip started
        if (ride.clientId) {
          const user = await User.findOne({ clerkId: ride.clientId }).select('emailPreferences email').lean()
          if (user?.email && user?.emailPreferences?.onInProgress !== false) {
            const email = rideInProgressEmail(user.email, rideDetails)
            await sendEmail(email)
          }
        }
        break
      }

      case 'paid': {
        // Notify driver that payment was received
        if (ride.driverId) {
          const user = await User.findOne({ clerkId: ride.driverId }).select('emailPreferences email').lean()
          if (user?.email && user?.emailPreferences?.onCompleted !== false) {
            const amount = ride.finalPrice || ride.estimatedPrice || 0
            const email = rideCompletedPaidEmail(user.email, amount, rideDetails)
            await sendEmail(email)
          }
        }
        break
      }

      case 'cancelled': {
        // Notify the other party
        const notifyId = cancelledBy === ride.clientId ? ride.driverId : ride.clientId
        const cancelledByName = cancelledBy === ride.clientId ? 'el cliente' : 'el conductor'

        if (notifyId) {
          const user = await User.findOne({ clerkId: notifyId }).select('emailPreferences email').lean()
          if (user?.email && user?.emailPreferences?.onCancelled !== false) {
            const email = rideCancelledEmail(user.email, rideDetails, cancelledByName, cancellationReason)
            await sendEmail(email)
          }
        }
        break
      }
    }
  } catch (err) {
    console.error(`[StatusEmail] Error sending status email for ride ${ride._id}:`, err)
  }
}
