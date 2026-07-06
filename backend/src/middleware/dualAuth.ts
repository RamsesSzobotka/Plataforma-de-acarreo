import type { MiddlewareHandler } from 'hono'
import { validateMcpToken } from '../mcp/server'
import { verifyMcpToken } from '../services/jwt'

function getClientIp(c: any): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || c.req.header('x-forwarded-host') || 'unknown'
}

export const dualAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const mcpUrl = process.env.MCP_PUBLIC_URL || 'http://localhost:3000'
  const reqId = crypto.randomUUID().slice(0, 8)
  const ip = getClientIp(c)
  const path = c.req.path

  console.log(`[DualAuth:${reqId}] ➡️ Request: ${c.req.method} ${path} from ${ip}`)

  // Step 1: Check MCP_API_KEY header or token query param (OpenCode/Codex compat)
  const apiKey = c.req.header('MCP_API_KEY') || c.req.query('token')
  if (apiKey) {
    console.log(`[DualAuth:${reqId}] 🔑 Attempting MCP_API_KEY auth — prefix=${apiKey.slice(0, 10)}...`)
    const clerkId = await validateMcpToken(apiKey)
    if (clerkId) {
      console.log(`[DualAuth:${reqId}] ✅ MCP_API_KEY auth success — clerkId=${clerkId}`)
      c.set('clerkId', clerkId)
      await next()
      return
    }
    console.log(`[DualAuth:${reqId}] ❌ MCP_API_KEY auth failed — invalid token`)
    return c.json({ error: 'Invalid MCP API key. Generate a new one via POST /api/auth/mcp-token.' }, 401)
  }

  // Step 2: Check Bearer token (OAuth — Claude Desktop)
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const tokenPreview = token.slice(0, 20) + '...'
    console.log(`[DualAuth:${reqId}] 🪪 Attempting OAuth Bearer auth — token=${tokenPreview}`)
    const payload = verifyMcpToken(token)
    if (payload) {
      console.log(`[DualAuth:${reqId}] ✅ OAuth Bearer auth success — sub=${payload.sub}, exp=${new Date(payload.exp * 1000).toISOString()}, client_id=${payload.client_id}`)
      c.set('clerkId', payload.sub)
      await next()
      return
    }
    // Token invalid — OAuth client needs to refresh
    console.log(`[DualAuth:${reqId}] ❌ OAuth Bearer auth failed — token expired or invalid`)
    console.log(`[DualAuth:${reqId}] 🔄 Sending WWW-Authenticate to trigger OAuth refresh flow`)
    c.header('WWW-Authenticate', `Bearer realm="mcp", scope="mcp:tools", error="invalid_token", error_description="The access token expired or is invalid", resource_metadata="${mcpUrl}/.well-known/oauth-protected-resource"`)
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // Step 3: No auth at all — OAuth discovery
  console.log(`[DualAuth:${reqId}] ⚠️ No auth credentials found — sending WWW-Authenticate for OAuth discovery`)
  console.log(`[DualAuth:${reqId}] 🔗 Resource metadata: ${mcpUrl}/.well-known/oauth-protected-resource`)
  // WWW-Authenticate with scope tells Claude Desktop which scope to request during OAuth
  c.header('WWW-Authenticate', `Bearer realm="mcp", scope="mcp:tools", resource_metadata="${mcpUrl}/.well-known/oauth-protected-resource"`)
  return c.json({
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32001,
      message: 'Authentication required. Use MCP_API_KEY header or OAuth 2.1 Bearer token.',
    },
  }, 401)
}
