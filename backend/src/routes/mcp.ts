import { Hono } from 'hono/tiny'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer, validateMcpToken } from '../mcp/server'
import { dualAuthMiddleware } from '../middleware/dualAuth'

const mcpApp = new Hono()

// ── MCP-specific rate limiting ───────────────────────────────────────────
// Stricter limits for MCP endpoints since they're machine-to-machine
// General API rate limit: 120 req/min (applied at /api/* level)
// MCP-specific: 300 req/min per IP (more permissive for tooling)

interface McpRateLimitEntry {
  count: number
  resetAt: number
}

const mcpRateLimitStore = new Map<string, McpRateLimitEntry>()

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of mcpRateLimitStore) {
    if (now > entry.resetAt) mcpRateLimitStore.delete(key)
  }
}, 5 * 60 * 1000)

function checkMcpRateLimit(ip: string, maxRequests = 300, windowMs = 60000): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  let entry = mcpRateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    mcpRateLimitStore.set(ip, entry)
  }

  entry.count++

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000)
    }
  }

  return { allowed: true, remaining: maxRequests - entry.count }
}

interface McpSession {
  transport: WebStandardStreamableHTTPServerTransport
  clerkId: string
}

const sessions = new Map<string, McpSession>()

/**
 * Asegura que el Request tenga el Accept header requerido por el SDK MCP.
 * El SDK exige que el cliente acepte tanto application/json como text/event-stream.
 * OpenCode no envía text/event-stream, así que lo inyectamos server-side.
 */
function ensureAcceptHeader(req: Request): Request {
  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/event-stream')) {
    return req
  }
  const newAccept = accept.includes('application/json')
    ? accept + ', text/event-stream'
    : 'application/json, text/event-stream'
  const headers = new Headers(req.headers)
  headers.set('accept', newAccept)
  return new Request(req, { headers })
}

/**
 * Endpoint de diagnóstico — no requiere auth.
 * Útil para que el agente verifique el estado de la conexión MCP.
 */
mcpApp.get('/status', async (c) => {
  // Rate limit check
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
  const rateLimit = checkMcpRateLimit(ip)
  c.header('X-RateLimit-Limit', '300')
  c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
  if (rateLimit.retryAfter) c.header('Retry-After', String(rateLimit.retryAfter))
  if (!rateLimit.allowed) {
    return c.json({ error: 'Demasiadas peticiones MCP.', retryAfter: rateLimit.retryAfter }, 429)
  }

  const token = c.req.header('MCP_API_KEY') || c.req.query('token')
  const authHeader = c.req.header('authorization')
  if (!token) {
    return c.json({
      status: 'unauthenticated',
      message: 'No hay token MCP configurado.',
      help: 'Agrega el header "MCP_API_KEY" con tu token MCP en opencode.json > mcp > carglyn > headers.',
      tokenInstructions: 'Para generar un token, usa: curl -X POST http://localhost:3000/api/auth/mcp-token -H "Authorization: Bearer <tu-sesion>"',
    })
  }
  const clerkId = await validateMcpToken(token)
  if (!clerkId) {
    return c.json({
      status: 'invalid_token',
      message: 'El token MCP proporcionado no es válido o ha expirado.',
      help: 'Genera un nuevo token via POST /api/auth/mcp-token (requiere auth web).',
    })
  }
  return c.json({
    status: 'authenticated',
    clerkId,
    message: 'Conexión MCP establecida correctamente.',
  })
})

mcpApp.all('/', dualAuthMiddleware, async (c) => {
  // Rate limit check
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
  const rateLimit = checkMcpRateLimit(ip)
  c.header('X-RateLimit-Limit', '300')
  c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
  if (rateLimit.retryAfter) c.header('Retry-After', String(rateLimit.retryAfter))
  if (!rateLimit.allowed) {
    return c.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Demasiadas peticiones.' } }, 429)
  }

  const clerkId = c.get('clerkId') as string | undefined
  if (!clerkId) {
    return c.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Authentication required.' } }, 401)
  }

  try {
    const rawReq = c.req.raw
    const req = ensureAcceptHeader(rawReq)
    const sessionId = req.headers.get('mcp-session-id')

    if (sessionId) {
      const existing = sessions.get(sessionId)
      if (existing) {
        // SECURITY: Verify the session belongs to the same clerkId making the request
        // This prevents cross-user session hijacking
        if (existing.clerkId !== clerkId) {
          return c.json({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32003,
              message: 'Forbidden: session belongs to another user.',
              data: {
                help: 'Cada usuario debe usar su propia sesión MCP.',
              },
            },
          }, 403)
        }
        return existing.transport.handleRequest(req, { authInfo: { token: '', clientId: '', scopes: [], extra: { clerkId } } })
      }
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    })

    const mcpServer = createMcpServer(clerkId)
    await mcpServer.connect(transport)

    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId)
      }
    }

    const response = await transport.handleRequest(req, { authInfo: { token: '', clientId: '', scopes: [], extra: { clerkId } } })

    if (transport.sessionId) {
      sessions.set(transport.sessionId, { transport, clerkId })
      c.req.raw.signal?.addEventListener('abort', () => {
        sessions.delete(transport.sessionId!)
      })
    }

    return response
  } catch (error) {
    console.error('MCP error:', error)
    return c.json({ error: 'Failed to handle MCP request' }, 500)
  }
})

export default mcpApp
