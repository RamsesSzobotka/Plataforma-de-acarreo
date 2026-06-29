# Separación WebSocket: Tracking vs Chat

## Objetivo
Eliminar la dependencia entre el tracking de ubicación del conductor y el chat. Actualmente ambos usan la misma conexión WebSocket (`wsService` singleton, endpoint `/ws/chat/:rideId`), causando que `Chat.tsx` al desmontarse llame `disconnect()` y bloquee permanentemente las conexiones del tracking.

## Nuevo Diseño

```
┌─────────────────┐     ┌──────────────────────┐
│  Chat.tsx        │────▶│  wsService (singleton)│────▶ /ws/chat/:rideId
└─────────────────┘     └──────────────────────┘
                         
┌─────────────────┐     ┌──────────────────────────┐
│  useDriverLocation │────▶│  trackingWs (new instance)│────▶ /ws/tracking/:rideId
└─────────────────┘     └──────────────────────────┘
```

Dos conexiones WebSocket completamente separadas:
- **Chat**: Mantiene el `wsService` actual, conecta a `/ws/chat/:rideId` — sin cambios
- **Tracking**: Nueva conexión a `/ws/tracking/:rideId` usando una nueva instancia de `WebSocketService`

---

## Paso 1: Backend — Agregar endpoint `/ws/tracking/:rideId`

### Archivo: `backend/src/index.ts`

Agregar un nuevo endpoint de upgrade WebSocket para tracking:

```typescript
// WebSocket upgrade — tracking del conductor
app.get('/ws/tracking/:rideId', (c) => {
  const rideId = c.req.param('rideId')
  const upgraded = server.upgrade(c.req.raw, { 
    data: { rideId: `tracking:${rideId}`, authenticated: false, clerkId: null } 
  })
  if (upgraded) return new Response(null)
  return c.text('WebSocket upgrade failed', 400)
})
```

> **Nota**: El `rideId` se prefija con `tracking:` para distinguir las conexiones en el mapa de conexiones. No es necesario crear un mapa separado — el `broadcastToRide` ya maneja por rideId.

### Archivo: `backend/src/index.ts` — Modificar handler `message()`

El handler de mensajes ya distingue por `message.type`:
- `chat` → broadcast (sin cambios)
- `location_update` → validación + Redis + broadcast (sin cambios)

No necesita cambios lógicos. La diferenciación ya existe por message.type.

### Archivo: `backend/src/index.ts` — Rate limiting

Si se desea, agregar rate limiting separado para tracking (más permisivo que chat):

```typescript
app.use('/ws/chat/*', rateLimiter(30, 60000))     // 30 upgrades/min por IP
app.use('/ws/tracking/*', rateLimiter(60, 60000))  // 60 upgrades/min por IP
```

---

## Paso 2: Frontend — Nuevo servicio `TrackingWebSocket`

### Crear archivo: `frontend/src/services/tracking-ws.ts`

```typescript
/**
 * Servicio WebSocket para tracking de ubicación del conductor.
 * Es una instancia SEPARADA del wsService de chat.
 */
import { WebSocketService } from './api'

// Instancia propia — NO compartida con el chat
export const trackingWsService = new WebSocketService()

/**
 * Conectar al tracking WebSocket
 */
export function connectTracking(rideId: string, token: string) {
  // Forzar reconexión incluso si trackingWsService fue desconectado
  trackingWsService.reconnect(rideId, token)
}

/**
 * Enviar ubicación
 */
export function sendTrackingLocation(rideId: string, coords: {
  latitude: number
  longitude: number
  heading?: number
  speed?: number
}) {
  trackingWsService.send({
    type: 'location_update',
    rideId,
    ...coords,
  })
}

/**
 * Desconectar tracking
 */
export function disconnectTracking() {
  trackingWsService.disconnect()
}
```

> **Importante**: `WebSocketService.connect()` tiene un bloqueo `isIntentionallyDisconnected` que impide reconectar. Para el tracking, siempre debemos poder reconectar. Ver Fix 4.

---

## Paso 3: Frontend — Modificar `useDriverLocation`

### Archivo: `frontend/src/hooks/useDriverLocation.ts`

Cambiar de `wsService` (chat) a `trackingWsService` (tracking):

```typescript
import { trackingWsService } from '../services/tracking-ws'

// En lugar de recibir wsService como prop, usar trackingWsService directamente
export function useDriverLocation({
  rideId,
  rideStatus,
  getToken,
  enabled: initialEnabled = true,
}: UseDriverLocationOptions): UseDriverLocationReturn {
  // ... mismo código, pero reemplazar wsService por trackingWsService
  
  // Auto-conectar cuando el viaje está activo
  useEffect(() => {
    if (rideStatus === 'in_progress' && rideId && !trackingWsService.getState().isConnected) {
      getToken().then(token => {
        if (token) trackingWsService.connect(rideId, token)
      })
    }
  }, [rideStatus, rideId, getToken])
  
  // Enviar ubicación
  const sendLocation = useCallback(async (pos: GeolocationPosition) => {
    // ... throttle ...
    
    if (trackingWsService.getState().isConnected) {
      trackingWsService.send(payload)
      return
    }
    
    // REST fallback igual que antes
    try {
      const token = await getToken()
      const { ridesAPI } = await import('../services/api')
      await ridesAPI.postLocation(rideId, { latitude, longitude, heading, speed }, token)
    } catch (err: any) {
      // ... manejo de errores igual que antes ...
    }
  }, [rideId, getToken])
  
  // ... resto igual ...
}
```

**Cambios clave**:
1. Eliminar `wsService` del parámetro `UseDriverLocationOptions`
2. Usar `trackingWsService` en lugar de `wsService`
3. El auto-conectar WS usa el tracking endpoint (que se configura en `trackingWsService.connect()`)

---

## Paso 4: Frontend — `WebSocketService.connect()` debe permitir reconexión siempre

### Archivo: `frontend/src/services/api.ts`

El método `connect()` actual bloquea cuando `isIntentionallyDisconnected=true`. Para el tracking, la reconexión debe ser siempre posible.

**Opción A (recomendada)**: Eliminar el chequeo `isIntentionallyDisconnected` del `connect()`:

```typescript
connect(rideId: string, token: string) {
  // ELIMINAR este bloque:
  // if (this.isIntentionallyDisconnected) {
  //   console.log('WebSocket intentionally disconnected, skipping reconnect')
  //   return
  // }
  
  // Resetear flag al reconectar
  this.isIntentionallyDisconnected = false
  
  // Resto igual...
}
```

**Opción B**: Crear un método `forceConnect()` que ignore el flag:

```typescript
forceConnect(rideId: string, token: string) {
  this.isIntentionallyDisconnected = false
  this.connect(rideId, token)
}
```

Para el tracking, siempre usar `forceConnect()`.

---

## Paso 5: Frontend — Modificar `DriverDashboard.tsx`

### Archivo: `frontend/src/pages/DriverDashboard.tsx`

Eliminar la dependencia de `wsService` (chat) del hook de tracking:

```typescript
// ANTES:
import { wsService } from '../services/api'
// ...
const { isSharing, toggleSharing, error: locationError, supported: geoSupported } = useDriverLocation({
  rideId: activeRide?._id ?? '',
  rideStatus: activeRide?.status ?? '',
  wsService,  // ← compartido con chat
  getToken: async () => (await getToken()) ?? '',
  enabled: true,
})

// DESPUÉS:
const { isSharing, toggleSharing, error: locationError, supported: geoSupported } = useDriverLocation({
  rideId: activeRide?._id ?? '',
  rideStatus: activeRide?.status ?? '',
  getToken: async () => (await getToken()) ?? '',
  enabled: true,
})
```

---

## Resumen de Cambios

| Archivo | Acción |
|---------|--------|
| `backend/src/index.ts` | Agregar endpoint `GET /ws/tracking/:rideId` |
| `frontend/src/services/tracking-ws.ts` | **NUEVO** — Servicio WS para tracking |
| `frontend/src/services/api.ts` | `WebSocketService.connect()` — eliminar bloqueo `isIntentionallyDisconnected` |
| `frontend/src/hooks/useDriverLocation.ts` | Usar `trackingWsService` en vez de parámetro `wsService` |
| `frontend/src/pages/DriverDashboard.tsx` | Eliminar `wsService` del llamado a `useDriverLocation` |
| `frontend/src/types/index.ts` | (opcional) Actualizar interfaces si es necesario |

## Cosas que NO cambian

- `Chat.tsx` — sigue usando `wsService` conectando a `/ws/chat/:rideId`
- `RideDetails.tsx` — sigue escuchando eventos de tracking en `wsService` (el broadcastToRide sigue funcionando porque el rideId es el mismo)
- `backend/src/services/redis.ts` — cambios previos (retryStrategy) se mantienen
- `backend/src/middleware/auth.ts` — cambios previos (cache dual) se mantienen
- `frontend/src/services/osrm.ts` — cambios previos (coverage check) se mantienen

## Nota sobre Broadcast

Cuando el conductor envía ubicación por `/ws/tracking/:rideId`, el backend hace:
```typescript
broadcastToRide(rideId, { type: 'driver_location', ... })
```

El cliente (que está en RideDetails escuchando `wsService` en `/ws/chat/:rideId`) **no va a recibir este broadcast** porque está en una sala diferente.

**Solución**: El broadcast debe enviarse a AMBAS salas. Modificar el handler de `location_update` para broadcast a la sala de chat también:

```typescript
// En backend/src/index.ts, después de guardar en Redis:
broadcastToRide(rideId, { type: 'driver_location', ... })      // Sala chat
broadcastToRide(`tracking:${rideId}`, { type: 'driver_location', ... })  // Sala tracking
```

O mejor, unificar: cuando el conductor envía location por tracking WS, el broadcast va al rideId normal (chat) para que los clientes en RideDetails lo reciban.

```typescript
// Siempre broadcast al rideId normal para los clientes
broadcastToRide(rideId, { type: 'driver_location', ... })
```

Esto funciona porque `broadcastToRide` busca conexiones por `rideId`. El conductor está conectado a `tracking:${rideId}`, así que su broadcast NO le llega a él mismo (evita eco). El cliente está en `rideId`, así que recibe el broadcast. Perfecto.
