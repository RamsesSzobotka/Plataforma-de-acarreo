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
let connected = false

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
      connected = true
      console.log('🔴 Redis conectado')
    })

    redis.on('ready', () => {
      connected = true
    })

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message)
    })

    redis.on('close', () => {
      connected = false
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

export function isRedisConnected(): boolean {
  return connected && redis?.status === 'ready'
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
): Promise<void> {
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
  } catch (err) {
    console.error('❌ Error guardando ubicación en Redis:', err)
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
    if (!data) return null
    return JSON.parse(data)
  } catch (err) {
    console.error('❌ Error leyendo ubicación de Redis:', err)
    return null
  }
}

/**
 * Eliminar ubicación de tracking (cuando el viaje termina).
 */
export async function clearDriverLocation(rideId: string): Promise<void> {
  try {
    const r = getRedis()
    const key = `tracking:location:${rideId}`
    await r.del(key)
  } catch (err) {
    console.error('❌ Error limpiando ubicación de Redis:', err)
  }
}

/**
 * Cerrar la conexión Redis gracefulmente.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
    connected = false
    console.log('🔴 Redis desconectado')
  }
}
