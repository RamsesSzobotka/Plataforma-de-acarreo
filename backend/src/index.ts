import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { poweredBy } from 'hono/powered-by'
import { Hono } from 'hono/tiny'
import { connectDB } from './db/mongo'
import rides from './routes/rides'
import auth from './routes/auth'
import users from './routes/users'
import messages from './routes/messages'
import payments from './routes/payments'
import health from './routes/health'
import upload from './routes/upload'
import admin from './routes/admin'

const app = new Hono()

// CORS config con headers para preflight
app.use('*', poweredBy({ serverName: 'PlataformaAcarreos' }))
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.use('*', logger())

// Rutas
app.get('/', (c) => c.json({ message: 'Plataforma de Acarreos API', version: '1.0.0' }))
app.route('/health', health)
app.route('/api/auth', auth)
app.route('/api/rides', rides)
app.route('/api/users', users)
app.route('/api/messages', messages)
app.route('/api/payments', payments)
app.route('/api/upload', upload)
app.route('/api/admin', admin)

// Error handler
app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

// Iniciar servidor
const PORT = parseInt(process.env.PORT || '3000')

export default {
  port: PORT,
  fetch: app.fetch,
}

async function initServer() {
  console.log(`🚀 Servidor iniciando en puerto ${PORT}...`)

  try {
    await connectDB()
    console.log('✅ MongoDB conectado')
    
    // Crear usuario admin inicial
    const { User } = await import('./models/user')
    const ADMIN_EMAIL = 'admin@gmail.com'
    const ADMIN_PASSWORD = 'Hola123!'
    
    await User.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✅ Usuario admin creado:', ADMIN_EMAIL)
    
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

if (process.env.NODE_ENV !== 'test') {
  initServer()
}