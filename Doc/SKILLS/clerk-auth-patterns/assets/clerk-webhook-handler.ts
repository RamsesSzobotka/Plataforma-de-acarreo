/**
 * Clerk Webhook Handler Template
 * 
 * Usage: Copiar a src/routes/auth.ts y completar las funciones
 */

import { Hono } from 'hono/tiny'
import { verifyWebhook } from '@clerk/clerk-sdk-node'
import type { WebhookEvent } from '@clerk/clerk-sdk-node'

// Placeholder para tu servicio de usuario
// Reemplazar con tu import real
// import { User } from '../models/user'

interface ClerkUserData {
  id: string
  email_addresses: { email_address: string }[]
  first_name?: string
  last_name?: string
  image_url?: string
  public_metadata?: { role?: 'client' | 'driver' | 'admin' }
}

const auth = new Hono()

/**
 * Webhook endpoint para Clerk
 * Configurar en Clerk Dashboard > Webhooks
 */
auth.post('/webhook', async (c) => {
  const payload = await c.req.text()
  const headers = c.req.headers()
  
  try {
    // Verificar firma del webhook
    const event = verifyWebhook(
      payload,
      headers,
      process.env.CLERK_WEBHOOK_SECRET
    ) as WebhookEvent
    
    // Procesar evento
    switch (event.type) {
      case 'user.created':
        await handleUserCreated(event.data as ClerkUserData)
        break
        
      case 'user.updated':
        await handleUserUpdated(event.data as ClerkUserData)
        break
        
      case 'user.deleted':
        await handleUserDeleted(event.data as { id: string })
        break
        
      default:
        console.log(`Evento no manejado: ${event.type}`)
    }
    
    return c.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return c.json({ error: 'Webhook processing failed' }, 400)
  }
})

/**
 * Sincronizar usuario nuevo a MongoDB
 */
async function handleUserCreated(userData: ClerkUserData) {
  console.log('Creando usuario:', userData.id)
  
  // TODO: Implementar con tu modelo User
  // await User.findOneAndUpdate(
  //   { clerkId: userData.id },
  //   {
  //     clerkId: userData.id,
  //     email: userData.email_addresses[0]?.email_address,
  //     firstName: userData.first_name,
  //     lastName: userData.last_name,
  //     imageUrl: userData.image_url,
  //     role: userData.public_metadata?.role || 'client',
  //   },
  //   { upsert: true, new: true }
  // )
}

/**
 * Actualizar usuario existente en MongoDB
 */
async function handleUserUpdated(userData: ClerkUserData) {
  console.log('Actualizando usuario:', userData.id)
  
  // TODO: Implementar con tu modelo User
  // await User.findOneAndUpdate(
  //   { clerkId: userData.id },
  //   {
  //     email: userData.email_addresses[0]?.email_address,
  //     firstName: userData.first_name,
  //     lastName: userData.last_name,
  //     imageUrl: userData.image_url,
  //     role: userData.public_metadata?.role || 'client',
  //     updatedAt: new Date()
  //   }
  // )
}

/**
 * Desactivar usuario eliminado en Clerk
 */
async function handleUserDeleted(data: { id: string }) {
  console.log('Desactivando usuario:', data.id)
  
  // TODO: Implementar con tu modelo User
  // await User.findOneAndUpdate(
  //   { clerkId: data.id },
  //   { isActive: false, updatedAt: new Date() }
  // )
}

export default auth