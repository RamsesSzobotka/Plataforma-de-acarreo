# 📋 Documentación Técnica - Plataforma de Acarreos

**Última Actualización**: 28 de abril de 2026  
**Versión**: 1.0

---

## 📑 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura](#arquitectura)
4. [Base de Datos](#base-de-datos)
5. [API Endpoints](#api-endpoints)
6. [Autenticación](#autenticación)
7. [Pagos](#pagos)
8. [Estructura de Carpetas](#estructura-de-carpetas)
9. [Modelos de Datos](#modelos-de-datos)
10. [Configuración y Deployment](#configuración-y-deployment)
11. [Scripts y Comandos](#scripts-y-comandos)

---

## Descripción General

**Plataforma de Acarreos** es un marketplace B2B/B2C de transporte de mercancías que conecta clientes con transportistas (conductores).

**Características principales:**
- Crear pedidos con múltiples imágenes
- Encontrar conductores disponibles cercanos
- Chat en tiempo real
- Pagos seguros con Stripe
- Calificaciones mutuas
- Tracking de entregas

**Modelo de Negocio:**
- Cliente crea pedido con imágenes y ubicaciones
- Conductores buscan pedidos disponibles
- Negociación de precio mediante chat
- Conductor acepta y realiza la entrega
- Pago automático al confirmar entrega
- Comisión: 90% conductor, 10% plataforma

---

## Stack Tecnológico

### Backend
| Tecnología | Versión | Uso |
|-----------|---------|-----|
| **Bun** | Última | Runtime JavaScript (alternativa a Node.js) |
| **Hono** | Última | Framework web minimalista para Bun |
| **MongoDB** | 5.0+ | Base de datos NoSQL |
| **Mongoose** | 7.0+ | ODM para MongoDB |
| **Stripe** | 11.0+ | Procesamiento de pagos |
| **Clerk** | Última | Autenticación SSO |
| **TypeScript** | 5.0+ | Lenguaje tipado |
| **dotenv** | Última | Gestión de variables de entorno |

### Frontend
| Tecnología | Versión | Uso |
|-----------|---------|-----|
| **React** | 18.0+ | Framework UI |
| **Vite** | 4.0+ | Bundler y dev server |
| **React Router** | 6.0+ | Enrutamiento |
| **Clerk React** | Última | Autenticación en frontend |
| **Stripe React** | 11.0+ | Integración de pagos |
| **TypeScript** | 5.0+ | Lenguaje tipado |
| **Material Symbols** | Google Fonts | Iconos |

### Infraestructura
| Servicio | Uso |
|---------|-----|
| **MongoDB Atlas** | Base de datos en la nube |
| **Docker** | Containerización (local development) |
| **Docker Compose** | Orquestación local |
| **Stripe Dashboard** | Gestión de webhooks y pagos |
| **Clerk Dashboard** | Gestión de usuarios y autenticación |

---

## Arquitectura

### Diagrama General

```
┌─────────────────────────────────────────────────────────────┐
│                      Navegador Cliente                       │
├─────────────────────────────────────────────────────────────┤
│  React App (Vite)                                           │
│  ├─ ClerkProvider (Autenticación)                           │
│  ├─ Elements Provider (Stripe)                              │
│  └─ BrowserRouter (Rutas)                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS/WS
             ↓
┌─────────────────────────────────────────────────────────────┐
│              API Backend (Bun + Hono)                        │
├─────────────────────────────────────────────────────────────┤
│  Routes:                                                     │
│  ├─ POST   /api/auth/webhook       (Clerk webhook)          │
│  ├─ GET    /api/rides              (Listar rides)           │
│  ├─ POST   /api/rides              (Crear ride)             │
│  ├─ PATCH  /api/rides/:id/status   (Cambiar estado)         │
│  ├─ POST   /api/payments/webhook   (Stripe webhook)         │
│  ├─ POST   /api/users/payment-method (Guardar PM)           │
│  └─ GET    /api/users/me/payment-method (Obtener PM)        │
│                                                              │
│  Middleware:                                                │
│  ├─ authMiddleware (JWT/Clerk)                             │
│  ├─ requireRole(['client'|'driver'|'admin'])               │
│  └─ ownership (Validar que el usuario es dueño)            │
└────────────┬────────────────────────────────────────────────┘
             │
      ┌──────┴──────┬──────────────┬──────────────┐
      ↓             ↓              ↓              ↓
  MongoDB       Clerk API     Stripe API    WebSocket
  (Datos)       (Auth)        (Pagos)       (Chat)
```

### Flujo de Autenticación

```
1. Usuario accede a /sign-in
   ↓
2. Clerk SignIn component abre modal
   ↓
3. Usuario autentica (SSO)
   ↓
4. Clerk envía webhook POST /api/auth/webhook
   ↓
5. Backend crea/actualiza usuario en MongoDB
   ↓
6. Frontend recibe token (session)
   ↓
7. Todos los requests incluyen Authorization header
```

---

## Base de Datos

### MongoDB Atlas Configuración

**URL de Conexión:**
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
```

**Base de datos:**
- `plataforma_acarreo` (producción)
- `plataforma_acarreo_dev` (desarrollo)

**Colecciones:**

| Colección | Documentos | Descripción |
|-----------|-----------|-------------|
| `users` | ~1000 | Usuarios (clientes, conductores, admins) |
| `drivers` | ~200 | Perfil completo de conductores con documentos |
| `rides` | ~5000 | Pedidos de transporte |
| `messages` | ~50000 | Mensajes del chat |
| `ratings` | ~1000 | Calificaciones mutuas |
| `processedevents` | ~10000 | Log de eventos Stripe (idempotencia) |

### Indexing Estrategia

```javascript
// users
db.users.createIndex({ clerkId: 1 })
db.users.createIndex({ role: 1 })
db.users.createIndex({ email: 1 })

// drivers
db.drivers.createIndex({ userId: 1 })
db.drivers.createIndex({ verificationStatus: 1 })
db.drivers.createIndex({ plate: 1 })

// rides
db.rides.createIndex({ status: 1 })
db.rides.createIndex({ clientId: 1 })
db.rides.createIndex({ driverId: 1 })
db.rides.createIndex({ createdAt: -1 })
db.rides.createIndex({ "pickupLocation.coordinates": "2dsphere" })

// messages
db.messages.createIndex({ rideId: 1 })
db.messages.createIndex({ createdAt: -1 })

// processedevents (TTL: 30 días)
db.processedevents.createIndex({ stripeEventId: 1 }, { unique: true })
db.processedevents.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 })
```

---

## API Endpoints

### Health Check
```
GET /health
Response: { status: "ok" }
```

### Autenticación
```
POST /api/auth/webhook
  - Webhook de Clerk (crea/actualiza usuario)
  - No requiere autenticación
  - Valida firma de Clerk

GET /api/auth/me
  - Obtiene usuario autenticado
  - Requiere: Authorization header
```

### Rides (Pedidos)
```
GET /api/rides
  - Listar rides
  - Query params: status, clientId, driverId, page, limit
  - Ownership: Clientes ven solo suyos, drivers ven todos

POST /api/rides
  - Crear ride
  - Requiere: clientId, title, description, type, pickupLocation, dropoffLocation, estimatedPrice, images
  - Body: { stripePaymentMethodId? }

GET /api/rides/:id
  - Obtener ride
  - Ownership check

PATCH /api/rides/:id
  - Actualizar ride (solo clientes)

PATCH /api/rides/:id/status
  - Cambiar estado
  - Automáticamente cobra si status → 'completed'

POST /api/rides/:id/accept
  - Aceptar ride (conductor)
  - Body: { driverId, agreedPrice }

POST /api/rides/:id/start
  - Iniciar viaje (conductor)

POST /api/rides/:id/delivery-photo
  - Subir foto de entrega
  - Body: { url, publicId }

POST /api/rides/:id/confirm-delivery
  - Confirmar entrega (cliente)

POST /api/rides/:id/cancel
  - Cancelar ride

GET /api/rides/:id/rate
  - Calificar ride

POST /api/messages
  - Enviar mensaje
  - Body: { rideId, content }

GET /api/messages/ride/:rideId
  - Obtener mensajes de un ride
```

### Usuarios
```
GET /api/users
  - Listar usuarios (admin only)

GET /api/users/:clerkId
  - Obtener usuario público

POST /api/users
  - Crear/actualizar usuario

POST /api/users/register-driver
  - Registrar como conductor
  - Requiere: todos los documentos obligatorios

GET /api/users/driver/:userId
  - Obtener perfil de conductor

GET /api/users/driver/me
  - Mi perfil de conductor

PATCH /api/users/driver/profile
  - Actualizar perfil de conductor

GET /api/users/me/payment-method
  - Obtener método de pago guardado

POST /api/users/payment-method
  - Guardar método de pago
  - Body: { stripePaymentMethodId }
```

### Pagos
```
POST /api/payments/create-intent
  - Crear PaymentIntent para pago manual
  - Body: { rideId, amount }

POST /api/payments/webhook
  - Webhook de Stripe (eventos de pago)
  - Verifica firma de Stripe
  - Idempotencia: evita duplicados

POST /api/payments/confirm
  - Confirmar pago procesado
  - Body: { rideId, paymentIntentId }

GET /api/payments/history
  - Historial de pagos del usuario
  - Query: page, limit

GET /api/payments/ride/:rideId
  - Detalles de pago de un ride
```

---

## Autenticación

### Clerk SSO

**Configuración:**
```env
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
```

**Proveedores Soportados:**
1. Google
2. Microsoft
3. UTP (Enterprise SAML)

**Roles:**
```
- 'client': Cliente regular
- 'driver': Conductor verificado
- 'admin': Administrador
```

**Middleware de Autenticación:**

```typescript
// authMiddleware: Valida JWT y extrae usuario
async authMiddleware(context) {
  const authHeader = context.req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  // Valida con Clerk
  const user = await clerkClient.verifyToken(token)
  context.set('user', {
    clerkId: user.sub,
    email: user.email,
    role: user.public_metadata.role
  })
}
```

---

## Pagos

### Stripe Integration

**Configuración:**
```env
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Flujo de Pago

#### 1. Guardar Método de Pago (Sin cobrar)
```
Cliente accede a AddPaymentMethod.tsx
  ↓
stripe.createPaymentMethod({ type: 'card' })
  ↓
POST /api/users/payment-method
  ↓
Guarda stripePaymentMethodId en BD
```

#### 2. Cobranza Automática (Al confirmar entrega)
```
Cliente confirma entrega
  ↓
PATCH /api/rides/:id/status → 'completed'
  ↓
Backend detecta: status='completed' + stripePaymentMethodId
  ↓
stripe.paymentIntents.create({
  off_session: true,
  confirm: true
})
  ↓
Si éxito → status='paid'
Si falla → status='completed' (reintentar manualmente)
```

#### 3. Pago Manual (Si falló automático)
```
Cliente ve PaymentForm.tsx
  ↓
POST /api/payments/create-intent
  ↓
stripe.confirmCardPayment(clientSecret)
  ↓
POST /api/payments/confirm
  ↓
Webhook procesa payment_intent.succeeded
  ↓
Status → 'paid'
```

### Comisiones

```
Monto Final: $100

Conductor recibe: $100 * 0.90 = $90
Plataforma: $100 * 0.10 = $10
```

Calculado automáticamente en metadata de PaymentIntent.

### Idempotencia

Se usa tabla `ProcessedEvent` para evitar procesar el mismo webhook dos veces:

```typescript
// Verifica si evento ya fue procesado
const existing = ProcessedEvent.findOne({ stripeEventId: event.id })
if (existing) return

// Procesa evento
// ...

// Guarda como procesado
ProcessedEvent.create({ stripeEventId: event.id, status: 'success' })
```

---

## Estructura de Carpetas

```
plataforma-de-acarreo/
│
├── backend/                           # Bun + Hono
│   ├── src/
│   │   ├── index.ts                   # Entry point servidor
│   │   ├── db/
│   │   │   └── mongo.ts               # Conexión MongoDB
│   │   ├── models/
│   │   │   ├── user.ts                # Schema usuario
│   │   │   ├── driver.ts              # Schema conductor
│   │   │   ├── ride.ts                # Schema pedido
│   │   │   ├── message.ts             # Schema mensaje
│   │   │   ├── rating.ts              # Schema calificación
│   │   │   └── processedEvent.ts      # Schema evento Stripe
│   │   ├── routes/
│   │   │   ├── auth.ts                # Autenticación
│   │   │   ├── rides.ts               # CRUD de rides
│   │   │   ├── users.ts               # Gestión usuarios
│   │   │   ├── messages.ts            # Chat
│   │   │   ├── payments.ts            # Pagos Stripe
│   │   │   ├── upload.ts              # Upload de imágenes
│   │   │   └── health.ts              # Health check
│   │   ├── middleware/
│   │   │   ├── auth.ts                # Validación JWT
│   │   │   ├── role.ts                # Validación de rol
│   │   │   └── index.ts               # Middleware combinado
│   │   └── utils/
│   │       └── upload.ts              # Utilidades upload
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker-compose.yml
│   └── .env.example
│
├── frontend/                          # React + Vite
│   ├── src/
│   │   ├── main.tsx                   # Entry point
│   │   ├── App.tsx                    # Router principal
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── AddPaymentMethod.tsx
│   │   │   ├── PaymentForm.tsx
│   │   │   ├── SavePaymentMethod.tsx
│   │   │   ├── AddressInput.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── ... (más componentes)
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── CreateRide.tsx
│   │   │   ├── MyRides.tsx
│   │   │   ├── RideDetails.tsx
│   │   │   ├── DriverDashboard.tsx
│   │   │   ├── DriverProfile.tsx
│   │   │   ├── Chat.tsx
│   │   │   ├── AddPaymentMethod.tsx
│   │   │   └── ... (más páginas)
│   │   ├── services/
│   │   │   └── api.ts                 # Cliente API
│   │   ├── types/
│   │   │   └── index.ts               # TypeScript interfaces
│   │   ├── styles/
│   │   │   └── index.css              # Estilos globales
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
│
├── admin-frontend/                    # Admin dashboard (React + Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Drivers.tsx
│   │   │   ├── Rides.tsx
│   │   │   ├── Users.tsx
│   │   │   └── ...
│   │   └── ...
│   └── ...
│
├── Doc/
│   ├── PRD-Plataforma de acarreso.md
│   ├── SKILLS/
│   │   ├── clerk-auth-patterns/
│   │   ├── stripe-webhook-patterns/
│   │   └── hono-backend-patterns/
│   └── ...
│
└── README.md
```

---

## Modelos de Datos

### User
```typescript
{
  _id: ObjectId
  clerkId: string (unique)
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  role: 'client' | 'driver' | 'admin'
  isActive: boolean
  phone?: string
  stripePaymentMethodId?: string
  createdAt: Date
  updatedAt: Date
}
```

### Driver
```typescript
{
  _id: ObjectId
  userId: string (clerkId)
  vehicleType: string
  plate: string
  capacityKg: number
  
  // Documentos obligatorios
  vehicleImages: [string]
  licenseType: string
  licenseImage: string
  cedulaFront: string
  cedulaBack: string
  ruvDocument: string
  plateImage: string
  insurancePolicy: string
  phone: string
  
  // Documentos opcionales
  carneBlanco?: string
  carneVerde?: string
  carneTransporteCarga?: string
  fumigationCertificate?: string
  
  // Verificación
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended'
  rejectionReason?: string
  reviewedBy?: string
  reviewedAt?: Date
  
  // Disponibilidad
  isAvailable: boolean
  currentLocation?: { type: 'Point', coordinates: [lng, lat] }
  
  // Calificación
  rating: number
  totalRides: number
  
  createdAt: Date
  updatedAt: Date
}
```

### Ride
```typescript
{
  _id: ObjectId
  clientId: string
  driverId?: string
  
  title: string
  description: string
  type: 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros'
  
  images: [{ url: string, publicId: string }]
  
  pickupLocation: {
    address: string
    type: 'Point'
    coordinates: [lng, lat]
  }
  dropoffLocation: {
    address: string
    type: 'Point'
    coordinates: [lng, lat]
  }
  
  estimatedPrice: number
  finalPrice?: number
  
  packages?: number
  weight?: number
  notes?: string
  preferredDate?: Date
  
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled'
  chatEnabled: boolean
  
  deliveryPhoto?: { url: string, publicId: string }
  cancellationReason?: string
  
  stripePaymentMethodId?: string
  paymentIntentId?: string
  paidAt?: Date
  
  createdAt: Date
  updatedAt: Date
}
```

### Message
```typescript
{
  _id: ObjectId
  rideId: string
  senderId: string
  content: string
  read: boolean
  createdAt: Date
}
```

### Rating
```typescript
{
  _id: ObjectId
  rideId: string
  raterId: string
  ratedId: string
  role: 'client' | 'driver'
  rating: 1 | 2 | 3 | 4 | 5
  comment?: string
  createdAt: Date
}
```

### ProcessedEvent
```typescript
{
  _id: ObjectId
  stripeEventId: string (unique)
  eventType: string
  rideId?: string
  paymentIntentId?: string
  status: 'success' | 'failed'
  processedAt: Date
  eventData: any
  error?: string
  createdAt: Date (TTL: 30 días)
}
```

---

## Configuración y Deployment

### Variables de Entorno

**Backend (.env)**
```env
# Base de datos
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Cloudinary (para upload de imágenes)
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx

# Servidor
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_CLOUDINARY_CLOUD_NAME=xxxxx
```

### Docker Compose (Desarrollo)

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: plataforma_acarreo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

### Deployment (Vercel + Railway)

**Backend:**
- Deployar en Railway.app (soporta Bun)
- Variables de entorno en settings

**Frontend:**
- Deployar en Vercel
- Variables de entorno en settings
- Build command: `bun run build`

---

## Scripts y Comandos

### Backend

```bash
# Desarrollo
bun run dev          # Inicia servidor con watch mode

# Producción
bun run start        # Inicia servidor

# Base de datos
bun run db:up        # Inicia MongoDB con Docker Compose
bun run db:down      # Detiene MongoDB
bun run db:logs      # Ver logs de MongoDB

# Admin
bun run admin:create # Crear usuario admin
```

### Frontend

```bash
# Desarrollo
bun run dev          # Dev server en localhost:5173

# Producción
bun run build        # Build optimizado
bun run preview      # Preview build local
```

### Docker

```bash
# Toda la stack
docker-compose up -d      # Inicia MongoDB
docker-compose down       # Detiene MongoDB
docker-compose logs -f    # Ver logs

# Verificar
docker ps                 # Ver contenedores activos
```

### Testing Stripe

```bash
# CLI local
stripe listen --forward-to localhost:3000/api/payments/webhook

# Simular evento
stripe trigger payment_intent.succeeded

# Ver eventos
stripe events list
```

---

## Dependencias Principales

### Backend

```json
{
  "hono": "^3.x",
  "mongoose": "^7.x",
  "stripe": "^11.x",
  "@clerk/backend": "^latest",
  "dotenv": "^16.x"
}
```

### Frontend

```json
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "@clerk/clerk-react": "^latest",
  "@stripe/react-stripe-js": "^1.x",
  "@stripe/stripe-js": "^1.x",
  "typescript": "^5.x"
}
```

---

## Guía de Contribución

### Rama de Desarrollo
- Rama actual: `R-dev`
- Rama principal: `Main-Dev`
- Hacer PR a `Main-Dev`

### Estándares de Código
- TypeScript obligatorio (no JavaScript)
- Estilos: Paleta de colores definida en AGENTS.md
- Iconos: Material Symbols
- Autenticación: Siempre validar con authMiddleware

---

**Documentación completada.**
