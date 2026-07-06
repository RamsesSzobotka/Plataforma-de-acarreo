import type { MiddlewareHandler } from 'hono'
import { validateMcpToken } from '../mcp/server'
import { verifyMcpToken } from '../services/jwt'

export const dualAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const mcpUrl = process.env.MCP_PUBLIC_URL || 'http://localhost:3000'

  // Step 1: Check MCP_API_KEY header or token query param (OpenCode/Codex compat)
  const apiKey = c.req.header('MCP_API_KEY') || c.req.query('token')
  if (apiKey) {
    const clerkId = await validateMcpToken(apiKey)
    if (clerkId) {
      c.set('clerkId', clerkId)
      await next()
      return
    }
    // API key provided but invalid — don't send OAuth headers
    c.status(401)
    return c.json({ error: 'Invalid MCP API key. Generate a new one via POST /api/auth/mcp-token.' })
  }

  // Step 2: Check Bearer token (OAuth — Claude Desktop)
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = verifyMcpToken(token)
    if (payload) {
      c.set('clerkId', payload.sub)
      await next()
      return
    }
    // Token invalid — OAuth client needs to refresh
    c.header('WWW-Authenticate', `Bearer realm="mcp", error="invalid_token", error_description="The access token expired or is invalid", resource_metadata="${mcpUrl}/.well-known/oauth-protected-resource"`)
    c.status(401)
    return c.json({ error: 'Invalid or expired token' })
  }

  // Step 3: No auth at all — OAuth discovery
  c.header('WWW-Authenticate', `Bearer realm="mcp", resource_metadata="${mcpUrl}/.well-known/oauth-protected-resource"`)
  c.status(401)
  return c.json({ error: 'Authentication required. Use MCP_API_KEY header or OAuth 2.1 Bearer token.' })
}
