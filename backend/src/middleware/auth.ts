import { verifyToken } from '@clerk/clerk-sdk-node'
import type { MiddlewareHandler } from 'hono'
import { db } from '../db/mongo'

export interface AuthUser {
  clerkId: string
  role: 'client' | 'driver' | 'admin'
  email: string
  firstName?: string
  lastName?: string
}

/**
 * Middleware de autenticación para validar JWT de Clerk
 * 
 * Flujo:
 * 1. Extrae token del header Authorization: Bearer <token>
 * 2. Verifica el token con Clerk
 * 3. Busca el usuario en MongoDB
 * 4. Setea el usuario en el contexto de Hono
 * 
 * Respuestas:
 * - 401: Sin token o usuario no registrado
 * - 403: Token inválido o expirado
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.headers().get('Authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization header required' }, 401)
  }
  
  const token = authHeader.split(' ')[1]
  
  if (!token) {
    return c.json({ error: 'Token required' }, 401)
  }
  
  try {
    // Verificar token con Clerk
    const session = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    })
    
    const clerkId = session.sub
    
    // Buscar usuario en MongoDB
    const user = await db.collection('users').findOne({ clerkId })
    
    if (!user) {
      return c.json({ error: 'User not registered' }, 401)
    }
    
    // Settear usuario en contexto
    c.set('user', {
      clerkId: user.clerkId,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    })
    
    await next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return c.json({ error: 'Invalid or expired token' }, 403)
  }
}