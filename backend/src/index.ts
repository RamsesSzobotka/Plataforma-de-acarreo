import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { poweredBy } from 'hono/powered-by'
import { Hono } from 'hono'
import { verifyToken } from '@clerk/clerk-sdk-node'
import { connectDB } from './db/mongo'
import rides from './routes/rides'
import auth from './routes/auth'
import users from './routes/users'
import messages from './routes/messages'
import payments from './routes/payments'
import webhooks from './routes/webhooks'
import health from './routes/health'
import upload from './routes/upload'
import admin from './routes/admin'

// Session cache (5 min TTL)
interface CachedSession { clerkId: string; expiresAt: number }
const sessionCache = new Map<string, CachedSession>()

async function getVerifiedSession(token: string): Promise<string | null> {
  const cached = sessionCache.get(token)
  if (cached && cached.expiresAt > Date.now()) return cached.clerkId
  try {
    const session = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    sessionCache.set(token, { clerkId: session.sub, expiresAt: Date.now() + 5 * 60 * 1000 })
    return session.sub
  } catch { return null }
}

// WebSocket store
interface WsConnection { ws: ServerWebSocket<WsData>; clerkId: string }
interface WsData { rideId: string; authenticated: boolean; clerkId: string | null }
const wsConnections = new Map<string, Set<WsConnection>>()

export function broadcastToRide(rideId: string, data: any) {
  const connections = wsConnections.get(rideId)
  if (!connections) return
  const message = JSON.stringify(data)
  connections.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message)
  })
}

const app = new Hono()

app.use('*', poweredBy({ serverName: 'PlataformaAcarreos' }))
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.use('*', logger())

// WebSocket upgrade — lo maneja Bun directamente
app.get('/ws/chat/:rideId', (c) => {
  const rideId = c.req.param('rideId')
  const upgraded = server.upgrade(c.req.raw, { data: { rideId, authenticated: false, clerkId: null } })
  if (upgraded) return new Response(null)          // Bun toma el control
  return c.text('WebSocket upgrade failed', 400)
})

app.get('/', (c) => c.json({ message: 'Carglyn API', version: '1.0.0' }))
app.route('/health', health)
app.route('/api/auth', auth)
app.route('/api/rides', rides)
app.route('/api/users', users)
app.route('/api/messages', messages)
app.route('/api/payments', payments)
app.route('/api/webhooks', webhooks)
app.route('/api/upload', upload)
app.route('/api/admin', admin)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => { console.error('Error:', err); return c.json({ error: 'Internal Server Error' }, 500) })

const PORT = parseInt(process.env.PORT || '3000')

// ✅ El servidor Bun con websocket nativo (sin createBunWebSocket)
const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
  websocket: {
    open(ws: ServerWebSocket<WsData>) {
      const { rideId } = ws.data
      console.log(`WebSocket open: rideId=${rideId}`)
    },
    async message(ws: ServerWebSocket<WsData>, msg: string | Buffer) {
      const { rideId } = ws.data
      try {
        const msgStr = msg instanceof Buffer ? msg.toString() : msg
        const message = JSON.parse(msgStr)

        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        if (message.type === 'auth' && message.token) {
          const clerkId = await getVerifiedSession(message.token)
          if (!clerkId) {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }))
            ws.close(4001, 'Invalid token')
            return
          }
          ws.data.authenticated = true
          ws.data.clerkId = clerkId
          if (!wsConnections.has(rideId)) wsConnections.set(rideId, new Set())
          wsConnections.get(rideId)!.add({ ws, clerkId })
          ws.send(JSON.stringify({ type: 'auth_success', clerkId }))
          return
        }

        if (!ws.data.authenticated) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
          return
        }

        if (message.type === 'chat' && message.content) {
          broadcastToRide(rideId, {
            type: 'chat',
            content: message.content,
            senderId: ws.data.clerkId,
            timestamp: Date.now(),
          })
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
      }
    },
    close(ws: ServerWebSocket<WsData>) {
      const { rideId, clerkId } = ws.data
      const connections = wsConnections.get(rideId)
      if (connections) {
        for (const conn of connections) {
          if (conn.ws === ws) { connections.delete(conn); break }
        }
        if (connections.size === 0) wsConnections.delete(rideId)
      }
      console.log(`WebSocket closed: rideId=${rideId}, clerkId=${clerkId}`)
    },
  },
})

// Necesitas declarar el tipo ServerWebSocket si TypeScript lo pide
declare const ServerWebSocket: any

async function initServer() {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
  try {
    await connectDB()
    console.log('✅ MongoDB conectado')
    const { User } = await import('./models/user')
    await User.createAdmin('admin@gmail.com', 'Hola123!')
    console.log('✅ Admin creado')
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

if (process.env.NODE_ENV !== 'test') initServer()

export default server