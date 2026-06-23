/**
 * Rate Limiter Middleware
 *
 * Limitador de peticiones en memoria (ventana deslizante por IP + ruta).
 * En producción considerar usar Redis para escalar horizontalmente.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Limpieza periódica cada 5 minutos para evitar memory leak
const CLEANUP_INTERVAL = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, CLEANUP_INTERVAL)

/**
 * Crea un middleware de rate limiting.
 *
 * @param maxRequests  Máximo de peticiones en la ventana (default: 100)
 * @param windowMs     Duración de la ventana en ms (default: 60s)
 */
export function rateLimiter(maxRequests = 100, windowMs = 60000) {
  return async (c: any, next: any) => {
    // Usar IP real (considerando proxies)
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown'

    // Clave única por IP + método + ruta base
    const route = c.req.path.replace(/\/[a-f0-9]{24}$/i, '/:id') // normalizar IDs de MongoDB
    const key = `${ip}:${c.req.method}:${route}`
    const now = Date.now()

    let entry = store.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      store.set(key, entry)
    }

    entry.count++

    // Headers informativos
    c.header('X-RateLimit-Limit', String(maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return c.json(
        {
          error: 'Demasiadas peticiones. Intenta de nuevo en unos segundos.',
          retryAfter,
        },
        429,
      )
    }

    await next()
  }
}
