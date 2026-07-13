import { Hono } from 'hono'
import { verifyToken } from '@clerk/clerk-sdk-node'
import { connectDB } from './db/mongo'
import { runMigrations } from './db/migrate'
import { Ride } from './models/ride'
import {
  broadcastToRide,
  addConnection,
  addUserConnection,
  removeConnection,
  type WsData,
} from './services/websocket'
import { saveDriverLocation, connectRedis } from './services/redis'
import { rateLimiter } from './middleware/rateLimiter'
import { monitoringMiddleware } from './middleware/monitoring'
import rides from './routes/rides'
import auth from './routes/auth'
import users from './routes/users'
import messages from './routes/messages'
import payments from './routes/payments'
import webhooks from './routes/webhooks'
import upload from './routes/upload'
import admin from './routes/admin'
import health from './routes/health'
import mcp from './routes/mcp'
import ratings from './routes/ratings'
import reports from './routes/reports'
import oauth from './routes/oauth'
import notifications from './routes/notifications'
import gdpr from './routes/gdpr'

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

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://carglyn-frontend.onrender.com',
]

function getAllowedOrigins() {
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []

  const frontendUrl = process.env.FRONTEND_URL?.trim()
  const origins = new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...configuredOrigins,
    ...(frontendUrl ? [frontendUrl] : []),
  ])

  if (process.env.NODE_ENV === 'production' && origins.size === 1) {
    console.warn('⚠️ CORS: Only default origins configured. Verify FRONTEND_URL or ALLOWED_ORIGINS.')
  }

  return origins
}

// Powered-by inline middleware (Hono v4 compatible)
app.use('*', async (c, next) => {
  c.header('X-Powered-By', 'PlataformaAcarreos')
  await next()
})

// CORS middleware inline (Hono v4 compatible)
app.use('*', async (c, next) => {
  const origin = c.req.header('origin')
  const allowedOrigins = getAllowedOrigins()
  if (origin && allowedOrigins.has(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Vary', 'Origin')
  }
  c.header('Access-Control-Allow-Credentials', 'true')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, MCP_API_KEY, mcp-session-id')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  if (c.req.method === 'OPTIONS') {
    return c.text(null, 204)
  }
  await next()
})

// Monitoring middleware (must be before logger to capture timing accurately)
app.use('*', monitoringMiddleware())

// Logger inline middleware (Hono v4 compatible)
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} - ${c.res.status} - ${ms}ms`)
})

// ── Rate limiting ───────────────────────────────────────────
// Aplica a todas las rutas /api/* y /ws/* (excepto health)
app.use('/api/*', rateLimiter(120, 60000))  // 120 req/min por IP/ruta
app.use('/ws/chat/*', rateLimiter(30, 60000))    // 30 upgrades/min por IP
app.use('/ws/tracking/*', rateLimiter(60, 60000))  // 60 upgrades/min por IP

// WebSocket upgrade — User notifications (driver dashboard)
app.get('/ws/user', (c) => {
  const upgraded = server.upgrade(c.req.raw, {
    data: { rideId: 'user', authenticated: false, clerkId: null }
  })
  if (upgraded) return new Response(null)
  return c.text('WebSocket upgrade failed', 400)
})

// WebSocket upgrade — Chat
app.get('/ws/chat/:rideId', (c) => {
  const rideId = c.req.param('rideId')
  const upgraded = server.upgrade(c.req.raw, { data: { rideId, authenticated: false, clerkId: null } })
  if (upgraded) return new Response(null)
  return c.text('WebSocket upgrade failed', 400)
})

// WebSocket upgrade — Tracking del conductor
app.get('/ws/tracking/:rideId', (c) => {
  const rideId = c.req.param('rideId')
  const upgraded = server.upgrade(c.req.raw, {
    data: { rideId: `tracking:${rideId}`, authenticated: false, clerkId: null }
  })
  if (upgraded) return new Response(null)
  return c.text('WebSocket upgrade failed', 400)
})

app.route('/health', health)
app.get('/', (c) => c.json({ message: 'Carglyn API', version: '1.0.0' }))
app.route('/api/auth', auth)
app.route('/api/rides', rides)
app.route('/api/users', users)
app.route('/api/messages', messages)
app.route('/api/payments', payments)
app.route('/api/webhooks', webhooks)
app.route('/api/upload', upload)
app.route('/api/admin', admin)
app.route('/mcp', mcp)
app.route('/', oauth)
app.route('/api/ratings', ratings)
app.route('/api/reports', reports)
app.route('/api/notifications', notifications)
app.route('/api/gdpr', gdpr)

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
      const isTracking = rideId?.startsWith('tracking:')
      console.log(`🔌 [WS] WebSocket open: rideId=${rideId}, isTracking=${isTracking}`)
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

        // ── User-level connection (driver dashboard) ────────────────
        if (rideId === 'user') {
          if (message.type === 'auth' && message.token) {
            const clerkId = await getVerifiedSession(message.token)
            if (!clerkId) {
              ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }))
              ws.close(4001, 'Invalid token')
              return
            }
            ws.data.authenticated = true
            ws.data.clerkId = clerkId
            addUserConnection(clerkId, ws)
            ws.send(JSON.stringify({ type: 'auth_success', clerkId }))
            return
          }
          // Ignore other message types on user connection (receive-only)
          return
        }

        if (message.type === 'auth' && message.token) {
          console.log(`🔐 [WS] Auth attempt for rideId=${rideId}`)
          const clerkId = await getVerifiedSession(message.token)
          if (!clerkId) {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }))
            ws.close(4001, 'Invalid token')
            return
          }

          // ── Validar participación en la sala ─────────────────────
          // Si es tracking, extraer rideId real (sin prefijo tracking:)
          const realRideId = rideId.startsWith('tracking:') ? rideId.slice(9) : rideId
          let canJoin = false
          try {
            const ride = await Ride.findById(realRideId)
            if (ride) {
              // Es cliente o driver del ride
              canJoin = ride.clientId === clerkId || ride.driverId === clerkId

              // Si no es participante directo, verificar si es admin
              if (!canJoin && ride.clientId) {
                const { db } = await import('./db/mongo')
                const user = await db.collection('users').findOne({ clerkId })
                canJoin = user?.role === 'admin'
              }

              // Si NO es tracking, aplicar reglas adicionales
              if (!rideId.startsWith('tracking:')) {
                // Permitir a drivers unirse a rides en 'requested'
                if (!canJoin && ride.status === 'requested') {
                  const { db } = await import('./db/mongo')
                  const user = await db.collection('users').findOne({ clerkId })
                  canJoin = user?.role === 'driver'
                }

                // Verificar si es driver con contact activo
                if (!canJoin) {
                  const { DriverContact } = await import('./models/driverContact')
                  const activeContact = await DriverContact.findOne({
                    driverId: clerkId,
                    rideId: realRideId,
                    isActive: true,
                  })
                  canJoin = !!activeContact
                }
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
          console.log(`✅ [WS] Auth success: clerkId=${clerkId}, rideId=${rideId}`)
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

        // ── Location update (tracking) ────────────────────────────
        if (message.type === 'location_update' && message.latitude && message.longitude) {
          // Extraer el rideId real (sin prefijo tracking:)
          const realRideId = rideId.startsWith('tracking:') ? rideId.slice(9) : rideId
          console.log(`📍 [TRACKING] Received location_update for rideId=${realRideId} from clerkId=${ws.data.clerkId}`)
          console.log(`📍 [TRACKING] Coords: lat=${message.latitude}, lng=${message.longitude}, heading=${message.heading}, speed=${message.speed}`)

          // Guardar en Redis con TTL
          const saveResult = await saveDriverLocation(realRideId, ws.data.clerkId!, {
            latitude: message.latitude,
            longitude: message.longitude,
            heading: message.heading,
            speed: message.speed,
          })
          console.log(`📍 [TRACKING] Redis save result:`, saveResult)

          // Broadcast al rideId normal (los clientes escuchan en wsService/chat WS)
          console.log(`📍 [TRACKING] Broadcasting driver_location to rideId=${realRideId}`)
          broadcastToRide(realRideId, {
            type: 'driver_location',
            driverId: ws.data.clerkId,
            latitude: message.latitude,
            longitude: message.longitude,
            heading: message.heading ?? 0,
            speed: message.speed ?? 0,
            timestamp: Date.now(),
          })
          console.log(`📍 [TRACKING] Broadcast sent successfully`)
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

async function initServer() {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
  try {
    await connectDB()
    console.log('✅ MongoDB conectado')

    // Conectar Redis (falla silenciosamente si no está disponible — tracking usa fallback)
    await connectRedis()

    // Run pending database migrations
    const count = await runMigrations()
    if (count > 0) {
      console.log(`✅ ${count} migraciones aplicadas`)
    } else {
      console.log('📦 Base de datos actualizada — sin migraciones pendientes')
    }

    const { User } = await import('./models/user')
    await User.createAdmin('admin@gmail.com', 'Hola123!')
    console.log('✅ Admin creado')
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

if (process.env.NODE_ENV !== 'test') initServer()

export default server
