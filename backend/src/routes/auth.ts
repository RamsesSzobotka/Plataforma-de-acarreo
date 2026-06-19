import { Hono } from 'hono/tiny'
import crypto from 'crypto'
import { hash } from 'bcryptjs'
import { authMiddleware } from '../middleware/auth'
import { saveMcpToken, getMcpToken, deleteMcpToken, createMcpTokenIndexes } from '../models/mcp-token'

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

// Generar token MCP
auth.post('/mcp-token', authMiddleware, async (c) => {
  const user = c.get('user')

  const rawToken = 'mcp_' + crypto.randomBytes(32).toString('hex')
  const tokenHash = await hash(rawToken, 10)

  await createMcpTokenIndexes()
  await saveMcpToken(user.clerkId, tokenHash)

  return c.json({
    data: {
      token: rawToken,
      message: 'Guarda este token en un lugar seguro. No podrás verlo de nuevo.',
    },
  })
})

// Status del token MCP
auth.get('/mcp-token/status', authMiddleware, async (c) => {
  const user = c.get('user')
  const mcpToken = await getMcpToken(user.clerkId)

  return c.json({
    data: {
      hasToken: !!mcpToken,
      createdAt: mcpToken?.createdAt || null,
      lastUsedAt: mcpToken?.lastUsedAt || null,
    },
  })
})

// Revocar token MCP
auth.delete('/mcp-token', authMiddleware, async (c) => {
  const user = c.get('user')
  await deleteMcpToken(user.clerkId)

  return c.json({ data: { message: 'Token revocado' } })
})

export default auth