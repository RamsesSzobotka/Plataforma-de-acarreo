import { verifyToken } from '@clerk/clerk-sdk-node'
import type { MiddlewareHandler } from 'hono'
import { db } from '../db/mongo'

export interface AuthUser {
  clerkId: string
  role: 'client' | 'driver' | 'admin'
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
}

async function getClerkUser(clerkId: string): Promise<{
  email: string
  firstName: string
  lastName: string
  imageUrl: string
} | null> {
  const response = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    return null
  }
  
  const data = await response.json()
  return {
    email: data.email_addresses?.[0]?.email_address || '',
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    imageUrl: data.image_url || '',
  }
}

/**
 * Middleware de autenticación para validar JWT de Clerk
 * 
 * Flujo:
 * 1. Extrae token del header Authorization: Bearer <token>
 * 2. Verifica el token con Clerk
 * 3. Busca el usuario en MongoDB
 * 4. Si no existe, lo crea como cliente automáticamente
 * 5. Setea el usuario en el contexto de Hono
 * 
 * Respuestas:
 * - 401: Sin token
 * - 403: Token inválido o expirado
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
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
    let user = await db.collection('users').findOne({ clerkId })
    
    //Si no existe, crearlo como cliente automáticamente
    if (!user) {
      // Obtener datos de Clerk directamente
      const clerkUser = await getClerkUser(clerkId)
      
      if (!clerkUser) {
        return c.json({ error: 'User not found in Clerk' }, 403)
      }
      
      const newUser = {
        clerkId,
        email: clerkUser.email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        role: 'client',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await db.collection('users').insertOne(newUser)
      user = { _id: newUser.clerkId, ...newUser }
      console.log(`Nuevo usuario creado: ${clerkId} como cliente`)
    }
    
    // Settear usuario en contexto
    c.set('user', {
      clerkId: user.clerkId,
      role: user.role || 'client',
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    })
    
    await next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return c.json({ error: 'Invalid or expired token' }, 403)
  }
}