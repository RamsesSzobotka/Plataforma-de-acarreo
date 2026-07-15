import { getDebugMode } from '../utils/debugLogger'

/**
 * Redis Service
 *
 * Conexión Redis y helpers para almacenar ubicaciones de tracking.
 * Se conecta automáticamente al iniciar usando REDIS_URL del .env
 * o fallback a localhost:6379.
 */

import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          console.error('❌ Redis: máximos reintentos alcanzados')
          return null // stop retrying
        }
        return Math.min(times * 200, 3000)
      },
      lazyConnect: true,
      enableOfflineQueue: false, // No acumular comandos si Redis está caído
    })

    redis.on('connect', () => {
      console.log('🔴 Redis conectado')
    })

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message)
    })
  }

  return redis
}

/**
 * Conectar Redis explícitamente (ideal llamar al iniciar el servidor).
 * Si Redis no está disponible, no lanza error — solo log y sigue funcionando
 * con fallos silenciosos en saveDriverLocation.
 */
export async function connectRedis(): Promise<void> {
  try {
    const r = getRedis()
    await r.connect()
    console.log('✅ Redis conexión establecida')
  } catch (err) {
    console.warn('⚠️ Redis no disponible al iniciar, se reintentará al usar tracking:', (err as Error).message)
  }
}

// ── Helpers de Tracking ────────────────────────────────────

const LOCATION_TTL = 30 * 60 // 30 minutos en segundos

/**
 * Guardar ubicación del conductor en Redis con TTL.
 * Clave: tracking:location:{rideId}
 */
export async function saveDriverLocation(
  rideId: string,
  driverId: string,
  coords: { latitude: number; longitude: number; heading?: number; speed?: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const r = getRedis()
    const key = `tracking:location:${rideId}`
    const data = JSON.stringify({
      driverId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: coords.heading ?? 0,
      speed: coords.speed ?? 0,
      updatedAt: Date.now(),
    })
    await r.setex(key, LOCATION_TTL, data)
    if (getDebugMode()) console.log(`[Redis] 💾 Location saved — rideId: ${rideId}, coords: [${coords.latitude}, ${coords.longitude}], ttl: ${LOCATION_TTL}s`)
    console.log(`✅ [REDIS] Saved driver location for rideId=${rideId}, key=${key}`)
    return { success: true }
  } catch (err) {
    console.error(`❌ [REDIS] Error saving location for rideId=${rideId}:`, err)
    return { success: false, error: String(err) }
  }
}

/**
 * Obtener la última ubicación del conductor para un ride.
 * Retorna null si no hay ubicación disponible o Redis no responde.
 */
export async function getDriverLocation(
  rideId: string,
): Promise<{
  driverId: string
  latitude: number
  longitude: number
  heading: number
  speed: number
  updatedAt: number
} | null> {
  try {
    const r = getRedis()
    const key = `tracking:location:${rideId}`
    const data = await r.get(key)
    if (!data) {
      console.log(`📭 [REDIS] No location found for rideId=${rideId}, key=${key}`)
      return null
    }
    if (getDebugMode()) console.log(`[Redis] 📍 Location read — rideId: ${rideId}, found: ${!!data}`)
    console.log(`✅ [REDIS] Got driver location for rideId=${rideId}:`, data)
    return JSON.parse(data)
  } catch (err) {
    console.error(`❌ [REDIS] Error reading location for rideId=${rideId}:`, err)
    return null
  }
}

// ── Helpers de Disponibilidad (cercanía) ────────────────────
// Ubicación del conductor cuando busca rides, no confundir con
// tracking en vivo (tracking:location:{rideId}) que se usa durante viajes activos.

const AVAILABILITY_TTL = 5 * 60 // 5 minutos en segundos

/**
 * Guardar ubicación de disponibilidad del conductor en Redis con TTL.
 * Clave: driver:location:{clerkId}
 * Diferente del tracking (tracking:location:{rideId}) que es por ride y 30min TTL.
 */
export async function saveDriverAvailabilityLocation(
  clerkId: string,
  lng: number,
  lat: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const r = getRedis()
    const key = `driver:location:${clerkId}`
    const data = JSON.stringify({ latitude: lat, longitude: lng, updatedAt: Date.now() })
    await r.setex(key, AVAILABILITY_TTL, data)
    return { success: true }
  } catch (err) {
    console.error(`❌ [REDIS] Error saving availability location for driver=${clerkId}:`, err)
    return { success: false, error: String(err) }
  }
}

/**
 * Obtener ubicación de disponibilidad del conductor.
 * Returns null si expiró o no hay datos.
 */
export async function getDriverAvailabilityLocation(
  clerkId: string,
): Promise<{ latitude: number; longitude: number; updatedAt: number } | null> {
  try {
    const r = getRedis()
    const key = `driver:location:${clerkId}`
    const data = await r.get(key)
    if (!data) return null
    return JSON.parse(data)
  } catch (err) {
    console.error(`❌ [REDIS] Error reading availability location for driver=${clerkId}:`, err)
    return null
  }
}

// ── Helpers GEO para rides disponibles ──────────────────────
// Usa Redis GEO (sorted set) para almacenar pickup locations
// de rides en estado 'requested' y consultar por cercanía.

const RIDES_GEO_KEY = 'rides:available'

/**
 * Agregar pickup location de un ride al set GEO de rides disponibles.
 * Se llama al crear un ride en estado requested.
 * Fire-and-forget: si Redis falla, el ride funciona sin geo.
 */
export async function addRidePickupLocation(
  rideId: string,
  lng: number,
  lat: number,
): Promise<void> {
  try {
    const r = getRedis()
    await r.geoadd(RIDES_GEO_KEY, lng, lat, rideId)
  } catch (err) {
    console.error(`❌ [REDIS] Error adding ride pickup GEO for ride=${rideId}:`, err)
  }
}

/**
 * Eliminar un ride del set GEO de rides disponibles.
 * Se llama al aceptar o cancelar un ride.
 */
export async function removeRidePickupLocation(rideId: string): Promise<void> {
  try {
    const r = getRedis()
    await r.zrem(RIDES_GEO_KEY, rideId)
  } catch (err) {
    console.error(`❌ [REDIS] Error removing ride from GEO set ride=${rideId}:`, err)
  }
}

/**
 * Obtener rideIds cercanos ordenados por distancia ascendente.
 * Retorna array de { rideId, distanceEnKm }.
 * Vacío si Redis no responde o no hay rides.
 */
export async function getNearbyRides(
  lng: number,
  lat: number,
  radiusKm: number = 20000, // ~half the earth, effectively "all rides"
  limit: number = 999,
): Promise<{ rideId: string; distance: number }[]> {
  try {
    const r = getRedis()
    // GEORADIUS with WITHDIST returns [[member, distance], ...]
    const results = await r.georadius(
      RIDES_GEO_KEY,
      lng,
      lat,
      radiusKm,
      'km',
      'WITHDIST',
      'ASC',
      'COUNT',
      limit,
    ) as [string, string][]

    return results.map(([rideId, distance]) => ({
      rideId,
      distance: Math.round(parseFloat(distance) * 100) / 100,
    }))
  } catch (err) {
    console.error(`❌ [REDIS] Error querying nearby rides:`, err)
    return []
  }
}


