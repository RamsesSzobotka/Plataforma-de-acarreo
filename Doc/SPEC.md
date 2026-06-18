# Especificaciones Detalladas - Portal del Conductor

Este documento contiene las especificaciones completas para implementar el Portal del Conductor.

---

# FASE 0: Infraestructura Base

## F0-1: Auth Middleware con Clerk

### Ubicación
```
backend/src/middleware/auth.ts
backend/src/__tests__/auth.test.ts
```

### Implementación

```typescript
// backend/src/middleware/auth.ts
import { createClerkClient } from '@clerk/clerk-sdk-node'
import { Context, Next } from 'hono'
import { db } from '../db/mongo'

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

export interface AuthUser {
  clerkId: string
  role: 'client' | 'driver' | 'admin'
  email: string
  firstName?: string
  lastName?: string
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json({ error: 'Authorization header required' }, 401)
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Invalid authorization format. Use: Bearer <token>' }, 401)
  }
  
  const token = authHeader.slice(7)
  
  if (!token) {
    return c.json({ error: 'Token required' }, 401)
  }
  
  try {
    // Verificar token con Clerk
    const claims = await clerkClient.verifyToken(token)
    const clerkId = claims.sub
    
    // Buscar usuario en MongoDB
    const usersCollection = db.collection('users')
    const user = await usersCollection.findOne({ clerkId })
    
    if (!user) {
      console.warn(`Auth: User not found for clerkId ${clerkId}`)
      return c.json({ error: 'User not registered' }, 401)
    }
    
    // Adjuntar usuario al contexto
    const authUser: AuthUser = {
      clerkId: user.clerkId,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    }
    
    c.set('user', authUser)
    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ error: 'Invalid or expired token' }, 403)
  }
}
```

### Registrar en index.ts

```typescript
// backend/src/index.ts
import { authMiddleware } from './middleware/auth'

// Rutas protegidas
app.use('/api/rides/*', authMiddleware)
app.use('/api/users/*', authMiddleware)
app.use('/api/messages/*', authMiddleware)
```

### Tests

```typescript
// backend/src/__tests__/auth.test.ts
import { describe, it, expect } from 'bun:test'

describe('Auth Middleware', () => {
  it('should return 401 without token', async () => {
    const res = await app.request('/api/rides')
    expect(res.status).toBe(401)
  })
  
  it('should return 401 with invalid format', async () => {
    const res = await app.request('/api/rides', {
      headers: { 'Authorization': 'Basic token' }
    })
    expect(res.status).toBe(401)
  })
  
  it('should return 403 with invalid token', async () => {
    const res = await app.request('/api/rides', {
      headers: { 'Authorization': 'Bearer invalid_token' }
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/auth/me', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
```

### Criterios de aceptación

- [x] Middleware en `backend/src/middleware/auth.ts`
- [x] Función `authMiddleware` exportada
- [x] Ruta `GET /api/auth/me` retorna datos del usuario
- [x] Tests en `backend/src/__tests__/auth.test.ts`
- [x] 401 para requests sin token
- [x] 403 para token inválido/expirado
- [x] Usuario adjuntado al contexto con c.get('user')
- [x] Validación con Clerk SDK
- [x] Búsqueda de role en MongoDB

---

## F0-2: Role Middleware

### Ubicación
```
backend/src/middleware/role.ts
```

### Implementación

```typescript
// backend/src/middleware/role.ts
import { Context, Next } from 'hono'
import { authMiddleware, type AuthUser } from './auth'

export type UserRole = 'client' | 'driver' | 'admin'

export interface RoleMiddlewareOptions {
  roles: UserRole[]
}

export function requireRole(roles: UserRole[]) {
  return async (c: Context, next: Next) => {
    // Primero verificar autenticación
    const user = c.get('user') as AuthUser | null
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    // Verificar rol
    if (!roles.includes(user.role)) {
      return c.json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: user.role
      }, 403)
    }
    
    await next()
  }
}

// Helpers
export function requireDriver() {
  return requireRole(['driver', 'admin'])
}

export function requireClient() {
  return requireRole(['client', 'admin'])
}

export function requireAdmin() {
  return requireRole(['admin'])
}
```

### Uso en rutas

```typescript
// backend/src/routes/rides.ts
import { requireDriver } from '../middleware/role'

rides.post('/:id/accept', requireDriver(), async (c) => {
  // Solo drivers pueden aceptar
})
```

### Criterios de aceptación

- [x] Middleware en `backend/src/middleware/role.ts`
- [x] Función `requireRole(roles)` exportada
- [x] Funciones helper: requireDriver(), requireClient(), requireAdmin()
- [x] Retorna 403 cuando rol no coincide
- [x] Integración con authMiddleware

---

## F0-3: Registro de Conductor

### Ubicación
```
backend/src/routes/register-driver.ts
frontend/src/pages/RegisterDriver.tsx
```

### Modelo Driver (MongoDB)

```typescript
// backend/src/models/driver.ts
const driverSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  vehicleType: { 
    type: String, 
    required: true,
    enum: ['camioneta', 'camion', 'furgon', 'grua', 'otro']
  },
  plate: { type: String, required: true, uppercase: true },
  capacityKg: { type: Number, required: true, min: 1 },
  vehicleBrand: { type: String },
  vehicleModel: { type: String },
  vehicleYear: { type: Number },
  vehicleColor: { type: String },
  isAvailable: { type: Boolean, default: true },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }
  },
  rating: { type: Number, default: 0 },
  totalRides: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true })

driverSchema.index({ userId: 1 }, { unique: true })
driverSchema.index({ currentLocation: '2dsphere' })
```

### Backend - Endpoint

```typescript
// backend/src/routes/register-driver.ts
import { Hono } from 'hono/tiny'
import { db } from '../db/mongo'
import { authMiddleware } from '../middleware/auth'
import { requireClient } from '../middleware/role'

const registerDriverRouter = new Hono()

registerDriverRouter.post('/', authMiddleware, requireClient(), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  
  const { vehicleType, plate, capacityKg, vehicleBrand, vehicleModel, vehicleYear, vehicleColor } = body
  
  // Validar campos requeridos
  if (!vehicleType || !plate || !capacityKg) {
    return c.json({ 
      error: 'Missing required fields',
      required: ['vehicleType', 'plate', 'capacityKg']
    }, 400)
  }
  
  // Validar placa
  const plateRegex = /^[A-Z]{3}-?\d{3,4}$/i
  if (!plateRegex.test(plate)) {
    return c.json({ error: 'Invalid plate format. Use: ABC-1234' }, 400)
  }
  
  // Validar capacidad
  if (capacityKg < 1 || capacityKg > 50000) {
    return c.json({ error: 'Capacity must be between 1 and 50000 kg' }, 400)
  }
  
  // Verificar que no sea già driver
  const driversCollection = db.collection('drivers')
  const existingDriver = await driversCollection.findOne({ userId: user.clerkId })
  
  if (existingDriver) {
    return c.json({ error: 'Already registered as driver' }, 400)
  }
  
  // Normalizar placa
  const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const formattedPlate = normalizedPlate.length === 6 
    ? `${normalizedPlate.slice(0,3)}-${normalizedPlate.slice(3)}`
    : normalizedPlate
  
  // Crear driver
  const newDriver = {
    userId: user.clerkId,
    vehicleType,
    plate: formattedPlate,
    capacityKg,
    vehicleBrand: vehicleBrand || null,
    vehicleModel: vehicleModel || null,
    vehicleYear: vehicleYear || null,
    vehicleColor: vehicleColor || null,
    isAvailable: true,
    rating: 0,
    totalRides: 0,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  await driversCollection.insertOne(newDriver)
  
  // Actualizar rol del usuario
  await db.collection('users').updateOne(
    { clerkId: user.clerkId },
    { $set: { role: 'driver', updatedAt: new Date() } }
  )
  
  return c.json({ success: true, message: 'Registered as driver' }, 201)
})

export default registerDriverRouter
```

### Frontend - Página

```typescript
// frontend/src/pages/RegisterDriver.tsx
import { useState } from 'react'

const VEHICLE_TYPES = [
  { value: 'camioneta', label: 'Camioneta', icon: 'local_shipping' },
  { value: 'camion', label: 'Camión', icon: 'local_shipping' },
  { value: 'furgon', label: 'Furgón', icon: 'warehouse' },
  { value: 'grua', label: 'Grúa', icon: 'construction' },
  { value: 'otro', label: 'Otro', icon: 'commute' },
]

export default function RegisterDriver() {
  const [form, setForm] = useState({
    vehicleType: '',
    plate: '',
    capacityKg: 0,
    vehicleBrand: '',
    vehicleModel: '',
    vehicleYear: undefined,
    vehicleColor: ''
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/users/register-driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
  }
  
  return (
    <div className="container">
      <h1>Registrarse como Conductor</h1>
      
      <form onSubmit={handleSubmit}>
        {/* Selector de tipo de vehículo */}
        <div className="vehicle-types">
          {VEHICLE_TYPES.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => setForm({...form, vehicleType: type.value})}
              className={form.vehicleType === type.value ? 'selected' : ''}
            >
              <span>{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
        
        {/* Placa */}
        <div>
          <label>Placa *</label>
          <input
            type="text"
            value={form.plate}
            onChange={e => setForm({...form, plate: e.target.value.toUpperCase()})}
            placeholder="ABC-1234"
            maxLength={8}
          />
        </div>
        
        {/* Capacidad */}
        <div>
          <label>Capacidad (kg) *</label>
          <input
            type="number"
            value={form.capacityKg}
            onChange={e => setForm({...form, capacityKg: parseInt(e.target.value)})}
            min={1}
            max={50000}
          />
        </div>
        
        {/* Datos opcionales */}
        <details>
          <summary>Datos adicionales (opcional)</summary>
          <input placeholder="Marca" value={form.vehicleBrand} onChange={e => setForm({...form, vehicleBrand: e.target.value})} />
          <input placeholder="Modelo" value={form.vehicleModel} onChange={e => setForm({...form, vehicleModel: e.target.value})} />
          <input type="number" placeholder="Año" value={form.vehicleYear} onChange={e => setForm({...form, vehicleYear: parseInt(e.target.value)})} />
          <input placeholder="Color" value={form.vehicleColor} onChange={e => setForm({...form, vehicleColor: e.target.value})} />
        </details>
        
        <button type="submit" className="btn btn-primary">
          Registrarse como Conductor
        </button>
      </form>
    </div>
  )
}
```

### Criterios de aceptación

- [x] Endpoint POST /api/users/register-driver
- [x] Valida vehicleType, plate, capacityKg
- [x] Normaliza formato de placa
- [x] Crea documento en colección "drivers"
- [x] Actualiza rol de usuario a "driver"
- [x] Página RegisterDriver.tsx
- [x] Selector visual de tipo de vehículo
- [x] Diseño con paleta turquesa (#0D9488)

---

## F0-4: Ver Perfil del Cliente

### Ubicación
```
backend/src/routes/users.ts (modificar)
frontend/src/components/ClientProfile.tsx
```

### Backend

```typescript
// GET /api/users/:clerkId - agregar rating y totalRides
users.get('/:clerkId', async (c) => {
  const { clerkId } = c.req.param()
  
  const user = await db.collection('users').findOne({ clerkId })
  if (!user) return c.json({ error: 'User not found' }, 404)
  
  // Calcular rating promedio
  const ratings = await db.collection('ratings').find({ ratedId: clerkId }).toArray()
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0
  
  // Contar rides completados
  const totalRides = await db.collection('rides').countDocuments({
    $or: [
      { clientId: clerkId, status: { $in: ['completed', 'paid'] } },
      { driverId: clerkId, status: { $in: ['completed', 'paid'] } }
    ]
  })
  
  return c.json({
    data: {
      clerkId: user.clerkId,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      rating: Math.round(avgRating * 10) / 10,
      totalRatings: ratings.length,
      totalRides,
      memberSince: user.createdAt
    }
  })
})
```

### Frontend

```typescript
// frontend/src/components/ClientProfile.tsx
export default function ClientProfile({ client }: { client: any }) {
  return (
    <div className="card">
      <h3>Cliente</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {client.imageUrl ? (
          <img src={client.imageUrl} alt={client.firstName} style={{ width: 64, height: 64, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)' }}>👤</div>
        )}
        <div>
          <p style={{ fontWeight: 600 }}>{client.firstName} {client.lastName}</p>
          <p>⭐ {client.rating > 0 ? `${client.rating}/5 (${client.totalRatings} calificaciones)` : 'Sin calificaciones'}</p>
          <p style={{ color: 'var(--text-muted)' }}>{client.totalRides} acarreos completados</p>
        </div>
      </div>
    </div>
  )
}
```

### Criterios de aceptación

- [x] GET /api/users/:clerkId retorna firstName, lastName, imageUrl
- [x] Incluye rating promedio
- [x] Incluye total de rides completados
- [x] Componente ClientProfile.tsx
- [x] Diseño con turquesa

---

# FASE 1: Dashboard

## F1-1: Búsqueda Geoespacial

### Backend

```typescript
// GET /api/rides?lat=-8.1&lng=-79.1&radius=25
rides.get('/', async (c) => {
  const { lat, lng, radius } = c.req.query()
  
  let ridesList
  
  if (lat && lng && radius) {
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)
    const radiusKm = parseFloat(radius) || 25
    const radiusRad = radiusKm / 6371
    
    ridesList = await db.collection('rides').find({
      status: 'requested',
      'pickupLocation.coordinates': {
        $geoWithin: {
          $centerSphere: [[longitude, latitude], radiusRad]
        }
      }
    }).limit(50).toArray()
    
    // Agregar distancia
    ridesList = ridesList.map(ride => ({
      ...ride,
      distance: calculateDistance(latitude, longitude, ride.pickupLocation.coordinates[1], ride.pickupLocation.coordinates[0])
    }))
  } else {
    ridesList = await db.collection('rides').find({ status: 'requested' }).limit(50).toArray()
  }
  
  return c.json({ data: ridesList })
})

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)² + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)²
  return Math.round((2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R * 10) / 10
}
```

### Frontend - Filtro de distancia

```typescript
const [radius, setRadius] = useState(25)

const DISTANCE_OPTIONS = [
  { value: 5, label: '5km' },
  { value: 10, label: '10km' },
  { value: 25, label: '25km' },
  { value: 50, label: '50km' },
]
```

### Criterios de aceptación

- [x] GET /api/rides acepta lat, lng, radius
- [x] Retorna pedidos dentro del radio
- [x] Incluye campo distance
- [x] Selector de radio (5/10/25/50km)
- [x] Badge de distancia en card

---

## F1-2: Lista de Pedidos

### Wireframe

```
┌─────────────────────────────────────────────────┐
│ Panel del Conductor                    [Perfil]   │
├─────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐              │
│ │📍 Pedidos   │ │🚛 Mis Acarreos│              │
│ │(12)         │               │              │
│ └──────────────┘ └──────────────┘              │
│ [Filtros: Buscar | Tipo | Precio]              │
│ ───────────────────────────────────────────   │
│ ┌──────────────────────────────────────────┐ │
│ │ 🏠 Mudanza - Apartamento 2 hab            │ │
│ │ 📍 Panama → 📍 Bella Vista            │ │
│ │ 📦 5 bultos • ~50kg                   │ │
│ │                              ┌────────┐│ │
│ │                              │  $150  ││ │
│ │ 📍 3.2km                    │[Aceptar]│ │
│ └──────────────────────────────┴────────┘ │
│ ...                                        │
└─────────────────────────────────────────────────┘
```

### Componente RideCard

```typescript
export default function RideCard({ ride, onAccept }: any) {
  return (
    <div className="card">
      <h3>{ride.title}</h3>
      <p>📍 {ride.pickupLocation.address} → 📍 {ride.dropoffLocation.address}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          {ride.packages && <span>📦 {ride.packages} bultos</span>}
          {ride.weight && <span> ~{ride.weight}kg</span>}
        </div>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            ${ride.estimatedPrice}
          </span>
          {ride.distance && <span className="badge">{ride.distance}km</span>}
          <button className="btn btn-primary" onClick={onAccept}>
            Aceptar pedido
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Criterios de aceptación

- [x] Lista de pedidos con cards
- [x] Información completa
- [x] Precio en JetBrains Mono
- [x] Botón Aceptar en turquesa
- [x] Badge de distancia

---

## F1-3: Historial de Acarreos

### Estados visuales

| Estado | Color | Icono |
|--------|-------|-------|
| accepted | #F97316 | ⏳ |
| in_progress | #0D9488 | 🚛 |
| completed | #22C55E | ✅ |
| paid | #22C55E | 💵 |
| cancelled | #EF4444 | ❌ |

### Componente MyRideCard

```typescript
export default function MyRideCard({ ride, onStart, onCancel }: any) {
  const STATUS_CONFIG = {
    accepted: { label: 'Aceptado', color: '#F97316' },
    in_progress: { label: 'En camino', color: '#0D9488' },
    completed: { label: 'Completado', color: '#22C55E' },
    paid: { label: 'Pagado', color: '#22C55E' },
    cancelled: { label: 'Cancelado', color: '#EF4444' }
  }
  
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ background: STATUS_CONFIG[ride.status].color, color: 'white', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
          {STATUS_CONFIG[ride.status].label}
        </span>
        <span>{new Date(ride.createdAt).toLocaleDateString()}</span>
      </div>
      <h3>{ride.title}</h3>
      <p>👤 {ride.clientName}</p>
      <p>📍 {ride.pickupLocation.address} → 📍 {ride.dropoffLocation.address}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <span>${ride.finalPrice || ride.estimatedPrice}</span>
        {ride.packages && <span>📦 {ride.packages} bultos</span>}
      </div>
      {ride.status === 'accepted' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={onStart}>Iniciar viaje</button>
          <button className="btn btn-outline" onClick={onCancel} style={{ color: 'var(--error)' }}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
```

### Criterios de aceptación

- [x] Lista de pedidos aceptados
- [x] Badge de estado con color correcto
- [x] Mostrar nombre del cliente
- [x] Acciones según estado

---

## F1-4: Detalle Completo del Pedido

### Wireframe

```
┌─────────────────────────────────────────────────┐
│ ← Volver                                         │
├─────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐  │
│ │        [ CARRUSEL DE IMÁGENES ]            │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ 📦 Mudanza - Apartamento 2 habitaciones    │
│ ───────────────────────────────────────────  │
│ ┌─────────────────┐ ┌─────────────────┐     │
│ │ 📍 Origen      │ │ 📍 Destino      │     │
│ │ Panama Center  │ │ Bella Vista     │     │
│ └─────────────────┘ └─────────────────┘     │
│ ───────────────────────────────────────────  │
│ Descripción:                                  │
│ [texto completo]                             │
│ ───────────────────────────────────────────  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │📦 Bultos│ │⚖️ Peso │ │💰 Precio │    │
│ └──────────┘ └──────────┘ └──────────┘    │
│ ───────────────────────────────────────────  │
│ 👤 Cliente • ⭐ 4.5 • 15 acarreos        │
│ ───────────────────────────────────────────  │
│         💰 $150                              │
│       [Aceptar pedido]                     │
└─────────────────────────────────────────────────┘
```

### Criterios de aceptación

- [x] Carrusel de imágenes
- [x] Título y tipo
- [x] Mapa con origen/destino
- [x] Descripción completa
- [x] Grid de información
- [x] Perfil del cliente
- [x] Botón "Aceptar pedido"

---

## F1-5: Aceptar Pedido

### Backend

```typescript
// PATCH /api/rides/:id/accept
rides.patch('/:id/accept', authMiddleware, requireDriver(), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { agreedPrice } = await c.req.json()
  
  const ride = await db.collection('rides').findOne({ _id: new ObjectId(id) })
  
  if (!ride) return c.json({ error: 'Ride not found' }, 404)
  if (ride.status !== 'requested') return c.json({ error: 'Ride no está disponible' }, 400)
  if (ride.driverId) return c.json({ error: 'Ride ya fue aceptado' }, 400)
  
  const finalPrice = agreedPrice || ride.estimatedPrice
  
  await db.collection('rides').updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        driverId: user.clerkId,
        finalPrice,
        status: 'accepted',
        chatEnabled: true,
        updatedAt: new Date()
      }
    }
  )
  
  return c.json({ success: true, ride: { _id: id, status: 'accepted', finalPrice } })
})
```

### Frontend - Modal

```typescript
export function AcceptRideModal({ ride, isOpen, onClose, onAccept }: any) {
  const [price, setPrice] = useState(ride.estimatedPrice)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  if (!isOpen) return null
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>✓ Confirmar aceptación</h2>
        <p>{ride.title}</p>
        <p>📍 {ride.pickupLocation.address} → 📍 {ride.dropoffLocation.address}</p>
        
        <label>Precio sugerido: ${ride.estimatedPrice}</label>
        <input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value))} />
        
        <small>*Puedes negociar un precio diferente</small>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleAccept} disabled={loading}>
            {loading ? 'Aceptando...' : '✓ Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Criterios de aceptación

- [x] Endpoint PATCH /api/rides/:id/accept
- [x] Valida status === "requested"
- [x] Guarda agreedPrice
- [x] Cambia status a "accepted"
- [x] Modal de confirmación
- [x] Input de precio negociable

---

# Resumen de Criterios

## Fase 0 (4 issues)
- F0-1: Auth middleware ✅
- F0-2: Role middleware ✅
- F0-3: Registro driver ✅
- F0-4: Perfil cliente ✅

## Fase 1 (5 issues)
- F1-1: Búsqueda geoespacial ✅
- F1-2: Lista pedidos ✅
- F1-3: Historial ✅
- F1-4: Detalle pedido ✅
- F1-5: Aceptar pedido ✅