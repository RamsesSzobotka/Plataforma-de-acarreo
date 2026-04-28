import type { MiddlewareHandler } from 'hono'
import type { AuthUser } from './auth'

type Role = 'client' | 'driver' | 'admin'

/**
 * Middleware de validación de roles
 * 
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Requiere que authMiddleware se haya ejecutado antes (c.get('user')).
 * 
 * @param allowedRoles - Lista de roles permitidos
 * 
 * Respuestas:
 * - 401: Usuario no autenticado
 * - 403: Rol no permitido
 */
export const requireRole = (...allowedRoles: Role[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get('user') as AuthUser | undefined
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }
    
    await next()
  }
}

// Alias para roleMiddleware (utilizado por rides.ts)
export const roleMiddleware = requireRole

// Helpers convenientes para casos comunes
export const requireDriver = () => requireRole('driver', 'admin')
export const requireClient = () => requireRole('client', 'admin')
export const requireAdmin = () => requireRole('admin')