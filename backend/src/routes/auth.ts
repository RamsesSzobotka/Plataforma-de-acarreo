import { Hono } from 'hono/tiny'

const auth = new Hono()

// Webhook de Clerk para sincronizar usuarios
auth.post('/webhook', async (c) => {
  // TODO: Implementar webhook de Clerk
  // 1. Verificar firma del webhook
  // 2. Sincronizar usuario en MongoDB
  // 3. Crear driver si es necesario
  
  return c.json({ message: 'Webhook endpoint - TODO' })
})

// Obtener usuario actual
auth.get('/me', async (c) => {
  // TODO: Obtener usuario desde Clerk y MongoDB
  // const { userId } = c.get('userId')
  return c.json({ message: 'Auth me endpoint - TODO' })
})

export default auth