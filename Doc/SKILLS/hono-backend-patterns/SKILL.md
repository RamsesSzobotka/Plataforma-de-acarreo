---
name: hono-backend-patterns
description: >
  Patrones de backend con Bun + Hono + MongoDB: estructura de rutas, modelos, middlewares, paginación, y buenas prácticas.
  Trigger: Cuando se crea backend con Hono, MongoDB, o se implementan rutas API.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Crear nuevas rutas API en el backend
- Implementar modelos Mongoose
- Crear middlewares (auth, role, ownership)
- Implementar paginación y filtros
- Configurar conexión a MongoDB

## Critical Patterns

### 1. Estructura de Servidor Hono

```typescript
// backend/src/index.ts
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { poweredBy } from 'hono/powered-by'
import { Hono } from 'hono/tiny'
import { connectDB } from './db/mongo'

const app = new Hono()

// Middlewares globales
app.use('*', poweredBy({ serverName: 'PlataformaAcarreos' }))
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))
app.use('*', logger())

// Rutas
app.get('/', (c) => c.json({ message: 'API v1' }))

// Montar rutas
app.route('/api/rides', ridesRouter)
app.route('/api/users', usersRouter)

export default {
  port: 3000,
  fetch: app.fetch,
}
```

### 2. Modelo Mongoose con Índices

```typescript
// backend/src/models/ride.ts
import mongoose from 'mongoose'

const rideSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  driverId: { type: String },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'],
    default: 'requested'
  },
  // GeoJSON para ubicaciones
  pickupLocation: {
    address: { type: String, required: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }
    }
  },
}, {
  timestamps: true
})

// Índices para búsquedas frecuentes
rideSchema.index({ pickupLocation: '2dsphere' })
rideSchema.index({ status: 1 })
rideSchema.index({ clientId: 1 })
rideSchema.index({ driverId: 1 })

export const Ride = mongoose.models.Ride || mongoose.model('Ride', rideSchema)
```

### 3. Ruta API con Paginación

```typescript
// backend/src/routes/rides.ts
import { Hono } from 'hono/tiny'
import { Ride } from '../models/ride'

const rides = new Hono()

rides.get('/', async (c) => {
  const status = c.req.query('status')
  const clientId = c.req.query('clientId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '10')
  
  const query: any = {}
  if (status) query.status = status
  if (clientId) query.clientId = clientId
  
  const skip = (page - 1) * limit
  
  const [ridesList, total] = await Promise.all([
    Ride.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Ride.countDocuments(query)
  ])
  
  return c.json({
    data: ridesList,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  })
})
```

### 4. Middleware de Error

```typescript
// Middleware de error global en index.ts
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({
    error: err.message || 'Internal Server Error'
  }, 500)
})

app.notFound((c) => c.json({
  error: 'Not Found'
}, 404))
```

### 5. Validación de body con Zod

```typescript
import { z } from 'zod'

const createRideSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  type: z.enum(['mudanza', 'electrodomésticos', 'muebles', 'productos', 'otros']),
  pickupLocation: z.object({
    address: z.string(),
    coordinates: z.array(z.number()).length(2)
  }),
  estimatedPrice: z.number().positive()
})

rides.post('/', async (c) => {
  const body = await c.req.json()
  const result = createRideSchema.safeParse(body)
  
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error }, 400)
  }
  
  const ride = new Ride(result.data)
  await ride.save()
  
  return c.json(ride, 201)
})
```

## Commands

```bash
# Iniciar backend en desarrollo
cd backend && bun run dev

# Iniciar MongoDB con Docker
cd backend && bun run db:up

# Ver logs de MongoDB
cd backend && bun run db:logs
```

## Resources

- **Templates**: Ver [assets/](assets/) para ejemplos adicionales
- **Documentación**: [Hono Docs](https://hono.dev), [Mongoose](https://mongoosejs.com)