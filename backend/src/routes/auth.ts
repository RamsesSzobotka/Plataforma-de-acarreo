import { Hono } from 'hono/tiny'
import crypto from 'crypto'
import { hash } from 'bcryptjs'
import { authMiddleware } from '../middleware/auth'
import { saveMcpToken, getMcpTokenByClerkId, deleteMcpToken, createMcpTokenIndexes } from '../models/mcp-token'
import { writeAuditEvent } from '../mcp/audit'

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
// Token format: mcp_<tokenId>_<secret>
// - tokenId: 16 hex chars for O(1) DB lookup
// - secret: 32 base64url chars (random)
// - Full token is hashed with bcrypt for comparison
auth.post('/mcp-token', authMiddleware, async (c) => {
  const user = c.get('user')

  // Generate token with new format: mcp_<tokenId>_<secret>
  const tokenId = crypto.randomBytes(8).toString('hex');    // 16 hex chars
  const secret = crypto.randomBytes(24).toString('base64url'); // ~32 chars
  const rawToken = `mcp_${tokenId}_${secret}`;

  // Hash the full token for secure comparison
  const tokenHash = await hash(rawToken, 10);

  await createMcpTokenIndexes();
  await saveMcpToken(user.clerkId, tokenId, tokenHash);

  // Audit token creation
  await writeAuditEvent({
    clerkId: user.clerkId,
    role: user.role,
    action: 'mcp.token.created',
    resourceType: 'token',
    success: true,
  });

  return c.json({
    data: {
      token: rawToken,  // Return full token - user must save it
      tokenId,          // Public lookup ID (informational)
      createdAt: new Date().toISOString(),
      message: 'Guarda este token en un lugar seguro. No podrás verlo de nuevo.',
    },
  })
})

// Status del token MCP
auth.get('/mcp-token/status', authMiddleware, async (c) => {
  const user = c.get('user')
  const mcpToken = await getMcpTokenByClerkId(user.clerkId)

  return c.json({
    data: {
      hasToken: !!mcpToken,
      tokenId: mcpToken?.tokenId || null,
      createdAt: mcpToken?.createdAt || null,
      lastUsedAt: mcpToken?.lastUsedAt || null,
    },
  })
})

// Revocar token MCP
auth.delete('/mcp-token', authMiddleware, async (c) => {
  const user = c.get('user')
  await deleteMcpToken(user.clerkId)

  // Audit token revocation
  await writeAuditEvent({
    clerkId: user.clerkId,
    role: user.role,
    action: 'mcp.token.revoked',
    resourceType: 'token',
    success: true,
  });

  return c.json({ data: { message: 'Token revocado' } })
})

export default auth