✅ PLAN COMPLETADO — El sistema de notificaciones de pedidos cercanos cada hora está implementado.

# Driver Nearby Rides Notifications — Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Notify connected drivers hourly about available rides within 20 km of their location via in-app notification.

**Architecture:** A `setInterval` in the server runs `checkNearbyRides()` every 60 minutes. It iterates drivers connected via WebSocket (`/ws/user`), checks their location in Redis (5-min TTL from availability pings), queries Redis GEO for nearby rides (20 km), and creates an in-app notification via `createNotification()` if rides are found.

**Tech Stack:** Bun/Hono, MongoDB/Mongoose, Redis (GEO + driver location), WebSocket (Bun native)

---

### Task 1: Add `'nearby_rides'` notification type to model, frontend type, and icon

**Files:**
- Modify: `backend/src/models/notification.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/pages/Notifications.tsx`

- [x] **Step 1: Add `'nearby_rides'` to Notification model enum**

In `backend/src/models/notification.ts`, line 7, add `'nearby_rides'` to the type enum:

```ts
enum: ['report_response', 'ride_message', 'offer_accepted', 'offer_received', 'ride_status', 'account_suspended', 'account_unsuspended', 'nearby_rides'],
```

- [x] **Step 2: Add `'nearby_rides'` to AppNotification type**

In `frontend/src/types/index.ts`, line 188, add `'nearby_rides'` to the type union:

```ts
type: 'report_response' | 'ride_message' | 'offer_accepted' | 'offer_received' | 'ride_status' | 'nearby_rides'
```

- [x] **Step 3: Add icon for `nearby_rides` in Notifications page**

In `frontend/src/pages/Notifications.tsx`, line 13, add to the `TYPE_ICONS` record:

```ts
nearby_rides: 'nearby',
```

- [x] **Step 4: Verify no type errors**

```bash
cd backend && bun run check-types 2>&1 || echo "No type check script"; cd ../frontend && bun run check-types 2>&1 || echo "No type check script"
```

---

### Task 2: Export `getConnectedUserIds()` from WebSocket service

**Files:**
- Modify: `backend/src/services/websocket.ts`

- [x] **Step 1: Add `getConnectedUserIds()` function**

After `getWsConnections()` (line 34), add:

```ts
/** Obtener todos los clerkId con conexión activa en /ws/user */
export function getConnectedUserIds(): string[] {
  return Array.from(userConnections.keys())
}
```

This returns all clerkIds currently connected via the `/ws/user` WebSocket endpoint. Returns empty array if nobody is connected.

---

### Task 3: Create `nearbyRidesNotifier.ts`

**Files:**
- Create: `backend/src/services/nearbyRidesNotifier.ts`

- [x] **Step 1: Create the service file**

Create `backend/src/services/nearbyRidesNotifier.ts`:

```ts
import { createNotification } from './notificationService'
import { getConnectedUserIds } from './websocket'
import { getDriverAvailabilityLocation, getNearbyRides } from './redis'
import { getDebugMode } from '../utils/debugLogger'
import { Ride } from '../models/ride'

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

    const now = Date.now()

    for (const clerkId of connectedIds) {
      // Anti-spam: skip if notified less than an hour ago
      const last = lastNotified.get(clerkId) ?? 0
      if (now - last < HOUR_MS) continue

      // Get driver's last known availability location from Redis
      const location = await getDriverAvailabilityLocation(clerkId)
      if (!location) {
        // Driver hasn't shared location recently — can't check proximity
        continue
      }

      // Query Redis GEO for nearby available rides (20km radius)
      const nearby = await getNearbyRides(
        location.longitude,
        location.latitude,
        NOTIFICATION_RADIUS_KM,
        999, // no limit — we just need the count
      )

      if (nearby.length === 0) continue // nothing nearby

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

      if (getDebugMode()) {
        console.log(`[NearbyRides] Notified driver=${clerkId}, rides=${nearby.length}`)
      }
    }
  } catch (err) {
    console.error('[NearbyRides] Error checking nearby rides:', err)
  }
}
```

- [x] **Step 2: Verify the file compiles**

```bash
cd backend && bun run check-types 2>&1 || bun x tsc --noEmit 2>&1 | head -30
```

---

### Task 4: Start interval in server entry point

**Files:**
- Modify: `backend/src/index.ts`

- [x] **Step 1: Import `checkNearbyRides`**

Near the other imports (around line 30-50), add:

```ts
import { checkNearbyRides } from './services/nearbyRidesNotifier'
```

- [x] **Step 2: Start interval after server initialization**

At the end of `initServer()` function (after line 358, inside the `try` block after admin creation), add:

```ts
// Start hourly nearby rides notification check
checkNearbyRides() // run immediately on startup, don't wait 1h
setInterval(checkNearbyRides, 60 * 60 * 1000) // then every hour
console.warn('🕐 Nearby rides notifications: hourly check active')
```

- [x] **Step 3: Verify the file compiles**

```bash
cd backend && bun run check-types 2>&1 || bun x tsc --noEmit 2>&1 | head -30
```

---

### Verification Checklist

- [x] Server starts without errors — the `setInterval` logs "Nearby rides notifications: hourly check active"
- [x] When a driver connects to `/ws/user`, has a valid location in Redis (`driver:location:{clerkId}`), and there are rides within 20 km — they receive an in-app notification with type `nearby_rides`
- [x] The notification appears in the Notifications page with the `nearby` icon
- [x] The notification includes the correct count: "Hay N acarreo(s) disponible(s) a menos de 20 km de tu ubicación"
- [x] Clicking the notification navigates to `/driver`
- [x] Drivers without a recent Redis location are skipped (no crash)
- [x] No second notification within the same hour (anti-spam)

Fecha de finalización: Julio 2026. Ver backend/src/services/nearbyRidesNotifier.ts
