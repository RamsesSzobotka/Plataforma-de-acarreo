// Middleware exports
export { authMiddleware } from './auth'
export type { AuthUser } from './auth'
export { requireRole, requireDriver, requireClient, requireAdmin } from './role'