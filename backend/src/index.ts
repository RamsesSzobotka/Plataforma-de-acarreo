import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { poweredBy } from 'hono/powered-by'
import { Hono } from 'hono'
import { verifyToken } from '@clerk/clerk-sdk-node'
import { connectDB } from './db/mongo'
import { Ride } from './models/ride'
import {
  broadcastToRide,
  addConnection,
  removeConnection,
  type WsData,
} from './services/websocket'
import { rateLimiter } from './middleware/rateLimiter'
import rides from './routes/rides'
import auth from './routes/auth'
import users from './routes/users'
import messages from './routes/messages'
import payments from './routes/payments'
import webhooks from './routes/webhooks'
import health from './routes/health'
import upload from './routes/upload'
import admin from './routes/admin'
import mcp from './routes/mcp'

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

const app = new Hono()

app.use('*', poweredBy({ serverName: 'PlataformaAcarreos' }))
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.use('*', logger())

// ── Rate limiting ───────────────────────────────────────────
// Aplica a todas las rutas /api/* y /ws/* (excepto health)
app.use('/api/*', rateLimiter(120, 60000))  // 120 req/min por IP/ruta
app.use('/ws/*', rateLimiter(30, 60000))    // 30 upgrades/min por IP

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
app.route('/api/mcp', mcp)

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

          // ── Validar participación en la sala ─────────────────────
          let canJoin = false
          try {
            const ride = await Ride.findById(rideId)
            if (ride) {
              // Es cliente o driver del ride
              canJoin = ride.clientId === clerkId || ride.driverId === clerkId

              // Si no es participante directo, verificar si es admin
              if (!canJoin && ride.clientId) {
                const { db } = await import('./db/mongo')
                const user = await db.collection('users').findOne({ clerkId })
                canJoin = user?.role === 'admin'
              }

              // Si no es participante ni admin, verificar si es driver con contact activo
              if (!canJoin) {
                const { DriverContact } = await import('./models/driverContact')
                const activeContact = await DriverContact.findOne({
                  driverId: clerkId,
                  rideId,
                  isActive: true,
                })
                canJoin = !!activeContact
              }
            }
          } catch (err) {
            console.error('Error validating WebSocket room access:', err)
          }

          if (!canJoin) {
            ws.send(JSON.stringify({
              type: 'auth_error',
              error: 'No eres participante de este acarreo',
            }))
            ws.close(4001, 'Not authorized')
            return
          }

          ws.data.authenticated = true
          ws.data.clerkId = clerkId
          addConnection(rideId, ws, clerkId)
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
      removeConnection(ws)
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