import { Hono } from 'hono/tiny'
import { authMiddleware } from '../middleware/auth'

const auth = new Hono()

// Webhook de Clerk para sincronizar usuarios (opcional - el registro automático ya se hace en authMiddleware)
auth.post('/webhook', async (c) => {
  // Este webhook es para eventos de Clerk como user.deleted
  // El registro automático de nuevos usuarios ya ocurre en authMiddleware
  return c.json({ message: 'Webhook received' })
})

// Obtener usuario actual
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json({ data: user })
})

export default auth