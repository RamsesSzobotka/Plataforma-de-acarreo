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

mcpApp.all('/', async (c) => {
  const clerkId = await mcpAuth(c)
  if (!clerkId) {
    return c.json({ error: 'MCP_API_KEY header or token query param required' }, 401)
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
