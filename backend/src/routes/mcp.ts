import { Hono } from 'hono/tiny'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer, validateMcpToken } from '../mcp/server'

const mcpApp = new Hono()

interface McpSession {
  transport: WebStandardStreamableHTTPServerTransport
  clerkId: string
}

const sessions = new Map<string, McpSession>()

async function mcpAuth(c: any): Promise<string | null> {
  const apiKey = c.req.header('MCP_API_KEY') || c.req.query('token')
  if (!apiKey) return null
  return validateMcpToken(apiKey)
}

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

mcpApp.all('/', async (c) => {
  const clerkId = await mcpAuth(c)
  if (!clerkId) {
    // Intentar parsear el body para dar un error JSON-RPC que el agente pueda interpretar
    try {
      const rawReq = c.req.raw.clone()
      const body = await rawReq.json()
      const rpcId = body.id ?? null
      const method = body.method || 'unknown'
      return c.json({
        jsonrpc: '2.0',
        id: rpcId,
        error: {
          code: -32001,
          message: 'Se requiere autenticación MCP.',
          data: {
            method,
            help: 'Agrega el header "MCP_API_KEY" con tu token en opencode.json > mcp > carglyn > headers.',
            tokenInstructions: 'Para generar un token, haz una petición POST a /api/auth/mcp-token con sesión web activa.',
            checkStatus: 'GET /api/mcp/status - endpoint de diagnóstico sin auth',
          },
        },
      }, 401)
    } catch {
      // Si no se puede parsear el body, devolver error genérico
      return c.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Se requiere autenticación MCP. Usa el header "MCP_API_KEY".',
          data: {
            help: 'Configura el token en opencode.json o visita GET /api/mcp/status para diagnóstico.',
          },
        },
      }, 401)
    }
  }

  try {
    const rawReq = c.req.raw
    const req = ensureAcceptHeader(rawReq)
    const sessionId = req.headers.get('mcp-session-id')

    if (sessionId) {
      const existing = sessions.get(sessionId)
      if (existing) {
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
