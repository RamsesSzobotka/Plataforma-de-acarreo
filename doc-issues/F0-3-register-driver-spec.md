# Issue F0-3: Registro de Conductor (Driver)

## Descripción
Crear endpoint para que un usuario se registre como conductor con información de su vehículo.

---

## 1. Ubicación de archivos

### Archivos a crear
```
backend/src/routes/register-driver.ts   # Nueva ruta
backend/src/__tests__/register-driver.test.ts
frontend/src/pages/RegisterDriver.tsx   # Nueva página frontend
```

### Archivos a modificar
```
backend/src/index.ts                # Registrar ruta
backend/src/routes/users.ts          # Agregar lógica existente
frontend/src/App.tsx              # Agregar Ruta
```

---

## 2. Modelo de datos

### Esquema Driver (MongoDB)

```typescript
// backend/src/models/driver.ts (ya existe - verificar)
const driverSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    ref: 'users.clerkId' 
  },
  vehicleType: { 
    type: String, 
    required: true,
    enum: ['camioneta', 'camion', 'furgon', 'grua', 'otro']
  },
  plate: { type: String, required: true, uppercase: true },
  capacityKg: { type: Number, required: true, min: 1 },
  vehicleBrand: { type: String },     // Ej: Toyota, Ford
  vehicleModel: { type: String },    // Ej: Hilux, F-150
  vehicleYear: { type: Number },     // Ej: 2020
  vehicleColor: { type: String },  // Ej: Blanco
  isAvailable: { type: Boolean, default: true },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: { type: [Number] }  // [lng, lat]
  },
  rating: { type: Number, default: 0 },
  totalRides: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  verificationDocs: [{
    license: String,
    insurance: String,
    vehicleDoc: String
  }]
}, { timestamps: true })

// Índices
driverSchema.index({ userId: 1 }, { unique: true })
driverSchema.index({ currentLocation: '2dsphere' })
driverSchema.index({ isAvailable: 1 })

export const Driver = mongoose.models.Driver || mongoose.model('Driver', driverSchema)
```

---

## 3. Backend - Endpoint

### Ruta POST /api/users/register-driver

```typescript
// backend/src/routes/register-driver.ts
import { Hono } from 'hono/tiny'
import { db } from '../db/mongo'
import { authMiddleware } from '../middleware/auth'
import { requireClient } from '../middleware/role'

const registerDriverRouter = new Hono()

/**
 * Registro de conductor
 * POST /api/users/register-driver
 * 
 * Body:
 * {
 *   vehicleType: 'camioneta' | 'camion' | 'furgon' | 'grua' | 'otro'
 *   plate: string (ej: "ABC-1234")
 *   capacityKg: number (ej: 1000)
 *   vehicleBrand?: string
 *   vehicleModel?: string
 *   vehicleYear?: number
 *   vehicleColor?: string
 * }
 */
registerDriverRouter.post('/', authMiddleware, requireClient(), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  
  // 1. Validar	body
  const { vehicleType, plate, capacityKg, vehicleBrand, vehicleModel, vehicleYear, vehicleColor } = body
  
  if (!vehicleType || !plate || !capacityKg) {
    return c.json({ 
      error: 'Missing required fields',
      required: ['vehicleType', 'plate', 'capacityKg']
    }, 400)
  }
  
  // Validar formato de placa (ej: ABC-1234 o ABC123)
  const plateRegex = /^[A-Z]{3}-?\d{3,4}$/i
  if (!plateRegex.test(plate)) {
    return c.json({ 
      error: 'Invalid plate format',
      hint: 'Use format: ABC-1234 or ABC1234'
    }, 400)
  }
  
  // Validar capacidad
  if (capacityKg < 1 || capacityKg > 50000) {
    return c.json({ 
      error: 'Capacity must be between 1 and 50000 kg'
    }, 400)
  }
  
  // 2. Verificar que usuario no es già driver
  const driversCollection = db.collection('drivers')
  const existingDriver = await driversCollection.findOne({ userId: user.clerkId })
  
  if (existingDriver) {
    return c.json({ error: 'Already registered as driver' }, 400)
  }
  
  // 3. Crear registro de driver
  const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const formattedPlate = normalizedPlate.length === 6 
    ? `${normalizedPlate.slice(0,3)}-${normalizedPlate.slice(3)}`
    : normalizedPlate
    
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
  
  // 4. Actualizar rol del usuario a 'driver'
  const usersCollection = db.collection('users')
  await usersCollection.updateOne(
    { clerkId: user.clerkId },
    { $set: { role: 'driver', updatedAt: new Date() } }
  )
  
  return c.json({
    success: true,
    message: 'Registered as driver',
    driver: {
      ...newDriver,
      _id: undefined  // No revelar ID interno
    }
  }, 201)
})

export default registerDriverRouter
```

### Registrar ruta en index.ts

```typescript
// backend/src/index.ts
import registerDriverRouter from './routes/register-driver'

// Montar rutas
app.route('/api/users', registerDriverRouter)
// Nota: La ruta real será /api/users/register-driver
```

---

## 4. Frontend - Página

### Página RegisterDriver.tsx

```typescript
// frontend/src/pages/RegisterDriver.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

interface DriverForm {
  vehicleType: string
  plate: string
  capacityKg: number
  vehicleBrand?: string
  vehicleModel?: string
  vehicleYear?: number
  vehicleColor?: string
}

const VEHICLE_TYPES = [
  { value: 'camioneta', label: 'Camioneta', icon: 'local_shipping' },
  { value: 'camion', label: 'Camión', icon: 'local_shipping' },
  { value: 'furgon', label: 'Furgón', icon: 'warehouse' },
  { value: 'grua', label: 'Grúa', icon: 'construction' },
  { value: 'otro', label: 'Otro', icon: 'commute' },
]

export default function RegisterDriver() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [form, setForm] = useState<DriverForm>({
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
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/users/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error registering')
      }
      
      navigate('/driver')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Registrarse como Conductor</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Complete los datos de su vehículo para comenzar a recibir pedidos
      </p>

      <form onSubmit={handleSubmit}>
        {/* Tipo de vehículo */}
        <div className="form-group">
          <label className="form-label">Tipo de vehículo *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {VEHICLE_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                className={`card ${form.vehicleType === type.value ? 'selected' : ''}`}
                onClick={() => setForm({ ...form, vehicleType: type.value })}
                style={{
                  padding: '1rem',
                  border: form.vehicleType === type.value 
                    ? '2px solid var(--primary)' 
                    : '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 32 }}>
                  {type.icon}
                </span>
                <span style={{ display: 'block', marginTop: '0.5rem' }}>{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Placa */}
        <div className="form-group">
          <label className="form-label">Placa *</label>
          <input
            type="text"
            className="input"
            placeholder="ABC-1234"
            value={form.plate}
            onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
            maxLength={8}
            required
          />
          <small style={{ color: 'var(--text-muted)' }}>Formato: ABC-1234</small>
        </div>

        {/* Capacidad */}
        <div className="form-group">
          <label className="form-label">Capacidad (kg) *</label>
          <input
            type="number"
            className="input"
            placeholder="1000"
            value={form.capacityKg || ''}
            onChange={(e) => setForm({ ...form, capacityKg: parseInt(e.target.value) })}
            min={1}
            max={50000}
            required
          />
        </div>

        {/* Datos opcionales del vehículo */}
        <details style={{ margin: '1.5rem 0' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--primary)' }}>
            Datos adicionales del vehículo (opcional)
          </summary>
          <div style={{ padding: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Marca</label>
              <input
                type="text"
                className="input"
                placeholder="Toyota"
                value={form.vehicleBrand}
                onChange={(e) => setForm({ ...form, vehicleBrand: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Modelo</label>
              <input
                type="text"
                className="input"
                placeholder="Hilux"
                value={form.vehicleModel}
                onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Año</label>
              <input
                type="number"
                className="input"
                placeholder="2020"
                value={form.vehicleYear || ''}
                onChange={(e) => setForm({ ...form, vehicleYear: parseInt(e.target.value) })}
                min={1990}
                max={2026}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input
                type="text"
                className="input"
                placeholder="Blanco"
                value={form.vehicleColor}
                onChange={(e) => setForm({ ...form, vehicleColor: e.target.value })}
              />
            </div>
          </div>
        </details>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Registrando...' : 'Registrarse como Conductor'}
        </button>
      </form>
    </div>
  )
}
```

### Ruta en App.tsx

```typescript
// frontend/src/App.tsx
import RegisterDriver from './pages/RegisterDriver'

// Agregar ruta
<Route path="register-driver" element={
  <ProtectedRoute>
    <RegisterDriver />
  </ProtectedRoute>
} />
```

---

## 5. Tests

```typescript
// backend/src/__tests__/register-driver.test.ts
describe('POST /api/users/register-driver', () => {
  it('should register a new driver', async () => {
    const form = {
      vehicleType: 'camioneta',
      plate: 'ABC-1234',
      capacityKg: 1000
    }
    const res = await app.request('/api/users/register-driver', {
      method: 'POST',
      body: JSON.stringify(form)
    })
    expect(res.status).toBe(201)
  })
  
  it('should reject invalid plate format', async () => {
    const form = {
      vehicleType: 'camioneta',
      plate: 'INVALID',
      capacityKg: 1000
    }
    const res = await app.request('/api/users/register-driver', {
      method: 'POST',
      body: JSON.stringify(form)
    })
    expect(res.status).toBe(400)
  })
})
```

---

## 6. Criterios de aceptación

Backend:
- [ ] Endpoint POST /api/users/register-driver
- [ ] Valida vehicleType, plate, capacityKg
- [ ] Normaliza formato de placa
- [ ] Crea documento en colección "drivers"
- [ ] Actualiza rol de usuario a "driver"
- [ ] Retorna error si ya es driver

Frontend:
- [ ] Página RegisterDriver.tsx
- [ ] Selector visual de tipo de vehículo
- [ ] Input de placa con validación
- [ ] Input de capacidad
- [ ] Datos opcionales (marca, modelo, año, color)
- [ ] Diseño con paleta turquesa
- [ ] Redirect a /driver después de registro

Tests:
- [ ] Tests en __tests__/register-driver.test.ts

---

## 7. Comandos

```bash
# Backend
cd backend && bun run dev

# Frontend  
cd frontend && bun run dev

# Test
cd backend && bun test src/__tests__/register-driver.test.ts
```

---

## Labels
`Driver` `Auth` `backend` `frontend`