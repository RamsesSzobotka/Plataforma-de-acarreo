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
    console.log(`✅ [REDIS] Got driver location for rideId=${rideId}:`, data)
    return JSON.parse(data)
  } catch (err) {
    console.error(`❌ [REDIS] Error reading location for rideId=${rideId}:`, err)
    return null
  }
}


