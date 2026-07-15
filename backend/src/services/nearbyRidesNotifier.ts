import { createNotification } from './notificationService'
import { getConnectedUserIds } from './websocket'
import { getDriverAvailabilityLocation, getNearbyRides } from './redis'
import { getDebugMode } from '../utils/debugLogger'

const NOTIFICATION_RADIUS_KM = 20
const HOUR_MS = 60 * 60 * 1000

// Guard: last notified timestamp per driver to prevent spam
const lastNotified = new Map<string, number>()

/**
 * Check nearby rides for all connected drivers and notify them.
 * Runs every hour via setInterval.
 */
export async function checkNearbyRides(): Promise<void> {
  try {
    const connectedIds = getConnectedUserIds()
    if (connectedIds.length === 0) {
      if (getDebugMode()) console.log('[NearbyRides] No connected users, skipping')
      return
    }

    if (getDebugMode()) {
      console.log(`[NearbyRides] Starting check — connected users: ${connectedIds.length}`)
    }

    const now = Date.now()
    let notifiedCount = 0

    for (const clerkId of connectedIds) {
      // Anti-spam: skip if notified less than an hour ago
      const last = lastNotified.get(clerkId) ?? 0
      if (now - last < HOUR_MS) {
        if (getDebugMode()) console.log(`[NearbyRides] Skip driver=${clerkId} — notified ${Math.round((now - last) / 60000)}min ago (cooldown)`)
        continue
      }

      // Get driver's last known availability location from Redis
      if (getDebugMode()) console.log(`[NearbyRides] Checking driver=${clerkId} — fetching availability location`)
      const location = await getDriverAvailabilityLocation(clerkId)
      if (!location) {
        if (getDebugMode()) console.log(`[NearbyRides] Skip driver=${clerkId} — no recent location (TTL expired)`)
        continue
      }

      // Query Redis GEO for nearby available rides (20km radius)
      if (getDebugMode()) {
        console.log(`[NearbyRides] Querying GEO near [${location.latitude}, ${location.longitude}] within ${NOTIFICATION_RADIUS_KM}km`)
      }
      const nearby = await getNearbyRides(
        location.longitude,
        location.latitude,
        NOTIFICATION_RADIUS_KM,
        999, // no limit — we just need the count
      )

      if (nearby.length === 0) {
        if (getDebugMode()) console.log(`[NearbyRides] Skip driver=${clerkId} — no rides within ${NOTIFICATION_RADIUS_KM}km`)
        continue
      }

      if (getDebugMode()) {
        console.log(`[NearbyRides] Driver=${clerkId} has ${nearby.length} nearby ride(s) — creating notification`)
      }

      // Create in-app notification (broadcasts via WebSocket automatically)
      await createNotification(
        clerkId,
        'nearby_rides',
        'Acarreos cercanos disponibles',
        `Hay ${nearby.length} acarreo(s) disponible(s) a menos de ${NOTIFICATION_RADIUS_KM} km de tu ubicación`,
        '/driver',
      )

      // Update last notified timestamp
      lastNotified.set(clerkId, now)
      notifiedCount++

      if (getDebugMode()) {
        console.log(`[NearbyRides] Notified driver=${clerkId}, rides=${nearby.length}`)
      }
    }

    if (getDebugMode()) {
      console.log(`[NearbyRides] Check complete — ${notifiedCount} driver(s) notified of ${connectedIds.length} connected`)
    }
  } catch (err) {
    console.error('[NearbyRides] Error checking nearby rides:', err)
  }
}
