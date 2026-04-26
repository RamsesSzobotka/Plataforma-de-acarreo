# AGENTS.md - Plataforma de Acarreos

Documento principal para guías de desarrollo, IA y equipo fullstack.  
Basado en el PRD "PRD-Plataforma de acarreso.md" con ajustes específicos del producto.

## 0. Visión y Objetivo del Producto

Plataforma tipo **marketplace C2C de acarreos** que combina:
- **Experiencia Uber**: tracking en tiempo real, perfil visible del conductor, calificaciones, pago digital.
- **Experiencia Facebook Marketplace**: cliente sube múltiples imágenes, descripción rica, chat directo para negociar.

**Nombre interno**: Plataforma de Acarreos

**Roles principales**:
- **Client** (Cliente)
- **Driver** (Acarreador / Conductor)
- **Admin** (Back Office)

## 1. Stack Tecnológico (Fijo según PRD)

**Frontend**: React + Vite  
**Backend**: Bun + Hono  
**Base de datos**: MongoDB  
**Autenticación**: Clerk (SSO)  
**Pagos**: Stripe

## 2. Estructura de Carpetas

```
plataforma-de-acarreo/
├── backend/                      # Bun + Hono
│   ├── src/
│   │   ├── index.ts              # Entry point del servidor
│   │   ├── db/
│   │   │   └── mongo.ts          # Conexión MongoDB
│   │   ├── models/
│   │   │   ├── ride.ts          # Modelo Ride
│   │   │   ├── user.ts         # Modelo User
│   │   │   ├── driver.ts        # Modelo Driver
│   │   │   └── message.ts       # Modelo Message
│   │   ├── routes/
│   │   │   ├── health.ts        # Health check
│   │   │   ├── auth.ts          # Autenticación (webhook)
│   │   │   ├── rides.ts        # CRUD Rides
│   │   │   ├── users.ts         # Gestión usuarios
│   │   │   ├── messages.ts      # Chat/Mensajes
│   │   │   └── payments.ts     # Stripe
│   │   ├── middleware/          # TODO: Auth, role, ownership
│   │   ├── services/           # TODO: Lógica de negocio
│   │   └── utils/             # TODO: Helpers
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker-compose.yml      # MongoDB + Redis
│   └── .env.example
│
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── main.tsx            # Entry point
│   │   ├── App.tsx             # Router principal
│   │   ├── components/
│   │   │   └── Layout.tsx     # Layout principal
│   │   ├── pages/
│   │   │   ├── Home.tsx        # Landing
│   │   │   ├── CreateRide.tsx  # Crear pedido
│   │   │   ├── MyRides.tsx    # Lista pedidos
│   │   │   ├── RideDetails.tsx # Detalles pedido
│   │   │   ├── DriverDashboard.tsx # Panel conductor
│   │   │   └── Chat.tsx       # Chat
│   │   ├── services/
│   │   │   └── api.ts        # API client
│   │   ├── types/
│   │   │   └── index.ts      # TypeScript interfaces
│   │   ├── hooks/            # Custom hooks (TODO)
│   │   ├── contexts/         # React contexts (TODO)
│   │   ├── utils/           # Helpers (TODO)
│   │   └── styles/
│   │       └── index.css    # Estilos globales
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── .env.example
│
└── Doc/
    └── PRD-Plataforma de acarreso.md
```

## 3. Autenticación

- Usar **Clerk** con SSO.
- Proveedores soportados:
  - Google
  - Microsoft
  - UTP (Universidad Tecnológica de Panamá) vía **Enterprise SSO** (SAML u OIDC)
- Roles se almacenan en metadata de Clerk y se sincronizan con MongoDB (`role`: "client" | "driver" | "admin")

## 4. Estados del Pedido (Ride)

Estados oficiales:
- `requested` → Pedido creado por el cliente
- `negotiating` → Hay chat activo / negociación de precio
- `accepted` → Conductor aceptó y se llegó a acuerdo
- `in_progress` → Conductor confirmó carga y comenzó el viaje (tracking activo)
- `completed` → Entrega realizada + foto subida
- `paid` → Pago confirmado vía Stripe
- `cancelled` → Cancelado

**Reglas importantes**:
- En `requested` y `negotiating`: Cliente puede editar o cancelar libremente.
- En `accepted`: 
  - Cliente **NO** puede editar ni cancelar.
  - Conductor **SÍ** puede cancelar (debe indicar motivo).
- En `in_progress`, `completed` o `paid`: **Ninguna de las partes** puede cancelar (solo Admin en casos excepcionales).

## 5. Requisitos Mínimos del Pedido (Cliente)

Al crear un pedido el cliente **debe** proporcionar:

**Campos obligatorios**:
- Título o descripción corta del acarreo
- Descripción detallada
- **Múltiples imágenes** (mínimo 1, máximo 8 recomendadas)
- Tipo de acarreo: `mudanza`, `electrodomésticos`, `muebles`, `productos`, `otros`
- Ubicación de partida (pickupLocation) – con mapa y búsqueda de dirección
- Ubicación de destino (dropoffLocation) – con mapa
- Precio sugerido (estimatedPrice)
- Número aproximado de bultos o peso estimado (opcional pero recomendado)
- Fecha y hora preferida (opcional)

**Campos adicionales recomendados**:
- Notas especiales (requiere ayuda para cargar, frágil, etc.)

## 6. Funcionalidades por Rol

### 6.1 Portal Cliente (Prioridad Alta)

**Obligatorio (MVP)**:
- Crear pedido con imágenes y ubicaciones
- Ver lista de mis pedidos (paginada y filtrada por estado)
- Ver detalles completos del pedido (imágenes incluidas)
- Chatear en tiempo real con el conductor que aceptó el pedido
- Ver tracking en tiempo real cuando el estado sea `in_progress`
- Ver foto de entrega subida por el conductor
- Confirmar entrega
- Realizar pago con Stripe
- Calificar al conductor (1-5 estrellas + comentario) - Solo después de `paid`
- Cancelar pedido según reglas de estado

### 6.2 Portal Conductor / Driver (Prioridad Alta)

**Obligatorio (MVP)**:
- Ver lista de pedidos cercanos (geolocalización + distancia)
- Ver detalles completos del pedido (todas las imágenes, descripción, ubicaciones)
- Ver perfil básico del cliente (nombre, foto, calificación)
- Chatear en tiempo real con el cliente
- Aceptar pedido (cambia estado a `accepted`)
- Cancelar pedido en estado `accepted` (con motivo)
- Confirmar “Ya tengo la mercancía cargada” al llegar al punto de partida
- Iniciar viaje (`in_progress`) después de confirmar carga
- Compartir ubicación en tiempo real mientras está `in_progress`
- Tomar y subir foto de la entrega al llegar al destino
- Ver perfil del cliente
- Calificar al cliente después de completar el servicio - Solo después de `paid`
- Ver historial de sus acarreos

### 6.3 Portal Admin (Prioridad Media-Alta)

- Gestión de usuarios y conductores
- Monitoreo de rides
- Gestión de pagos y conciliación con Stripe
- Auditoría de acciones
- Cancelaciones excepcionales

## 7. Chat entre Cliente y Conductor

- Implementar con **WebSockets** (Hono + Socket.IO o nativo de Bun).
- Chat por cada ride (un canal por `rideId`).
- Mensajes guardados en MongoDB.
- Notificaciones en tiempo real cuando llega un nuevo mensaje.
- Disponible una vez el pedido está en `negotiating` o `accepted`.

## 8. Flujo Principal del Ride

1. Cliente crea pedido → `requested`
2. Conductor ve pedido cercano, chatea y negocia
3. Conductor acepta → `accepted` (precio final acordado)
4. Conductor llega al pickup → confirma "Ya tengo la mercancía"
5. Conductor inicia viaje → `in_progress` + tracking activo
6. Conductor llega al destino, sube foto de entrega
7. Cliente confirma entrega → `completed`
8. Cliente realiza pago → Stripe PaymentIntent + webhook → `paid`
9. **Ambas partes se califican mutuamente** → Solo disponible después de `paid`

## 9. Modelo de Datos

### rides
```typescript
{
  _id: ObjectId
  clientId: string              // clerkId
  driverId?: string
   
  title: string
  description: string
  type: 'mudanza' | 'electrodomésticos' | 'muebles' | 'productos' | 'otros'
   
  images: [{ url: string, publicId?: string }]
   
  pickupLocation: {
    address: string
    coordinates: { type: 'Point', coordinates: [lng, lat] }
  }
  dropoffLocation: {
    address: string
    coordinates: { type: 'Point', coordinates: [lng, lat] }
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
   
  createdAt: Date
  updatedAt: Date
}
```

### users
```typescript
{
  _id: ObjectId
  clerkId: string              // ID de Clerk - único
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
   
  role: 'client' | 'driver' | 'admin'
  isActive: boolean
  phone?: string
   
  createdAt: Date
  updatedAt: Date
}
```

### drivers
```typescript
{
  _id: ObjectId
  userId: string              // clerkId
   
  vehicleType: string
  plate: string
  capacityKg: number
   
  isAvailable: boolean
  currentLocation?: { type: 'Point', coordinates: [lng, lat] }
   
  rating: number
  totalRides: number
  isVerified: boolean
   
  createdAt: Date
  updatedAt: Date
}
```

### messages
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

### ratings (Calificaciones)
```typescript
{
  _id: ObjectId
  rideId: string           // Ride asociado
  raterId: string         // Quién califica (clerkId)
  ratedId: string        // Quién recibe la calificación (clerkId)
  role: 'client' | 'driver'  // Rol de quién recibe la calificación
  
  rating: number         // 1-5 estrellas
  comment?: string      // Comentario opcional
   
  createdAt: Date
}
```

## 10. Pagos y Comisiones

### Comisiones (TU GANANCIA)
- **Comisión de plataforma**: 10% del monto final del ride
- El conductor recibe: `finalPrice * 0.90` (90%)
- Tu ganancia: `finalPrice * 0.10` (10%)

### Флуйо де Паго
- Cliente пага al confirmar entrega usando Stripe PaymentIntent.
- Backend recibe webhook de Stripe para confirmar `paid`.
- **Al conductor se le descuenta el 10%** automáticamente antes de transferir.
- No implementar payouts semanales todavía (se dejará para fase 2).

## 11. API Endpoints

### Health
- `GET /health` - Estado del servidor

### Auth
- `POST /api/auth/webhook` - Webhook de Clerk
- `GET /api/auth/me` - Usuario actual

### Rides
- `GET /api/rides` - Listar rides (filtros: status, clientId, driverId)
- `POST /api/rides` - Crear ride
- `GET /api/rides/:id` - Obtener ride
- `PATCH /api/rides/:id` - Actualizar ride
- `PATCH /api/rides/:id/status` - Cambiar estado
- `POST /api/rides/:id/accept` - Aceptar ride (driver)
- `POST /api/rides/:id/start` - Iniciar viaje
- `POST /api/rides/:id/delivery-photo` - Subir foto de entrega
- `POST /api/rides/:id/cancel` - Cancelar ride

### Users
- `GET /api/users` - Listar usuarios (admin)
- `GET /api/users/:clerkId` - Obtener usuario
- `POST /api/users` - Crear/actualizar usuario
- `POST /api/users/register-driver` - Registrar como driver
- `GET /api/users/driver/:userId` - Perfil de driver
- `PATCH /api/users/driver/:userId/availability` - Disponibilidad
- `PATCH /api/users/driver/:userId/location` - Ubicación

### Messages
- `GET /api/messages/ride/:rideId` - Mensajes de un ride
- `POST /api/messages` - Enviar mensaje
- `PATCH /api/messages/ride/:rideId/read` - Marcar leídos

### Payments
- `POST /api/payments/create-intent` - Crear PaymentIntent
- `POST /api/payments/webhook` - Webhook de Stripe
- `POST /api/payments/confirm` - Confirmar pago

## 12. Variables de Entorno

### Backend (.env)
```
DATABASE_URL=mongodb://admin:password@localhost:27017/plataforma_acarreo
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
PORT=3000
NODE_ENV=development
```

### Frontend (.env)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

## 13. Scripts

### Backend
```bash
cd backend
bun run dev          # Desarrollo con watch
bun run start       # Producción
bun run db:up       # Iniciar MongoDB (Docker)
bun run db:down     # Detener MongoDB
bun run db:logs     # Ver logs de MongoDB
```

### Frontend
```bash
cd frontend
bun run dev         # Desarrollo
bun run build      # Build producción
bun run preview   # Preview producción
```

## 14. Orden de Implementación Recomendado

1. Configuración base (Bun + Hono, MongoDB, Clerk SSO con Google/Microsoft/UTP)
2. Auth + Roles + Middleware (auth, role, ownership)
3. Módulo de Rides + creación de pedido con imágenes
4. Portal Cliente básico
5. Portal Conductor + visualización de pedidos cercanos
6. Chat en tiempo real (WebSockets)
7. Estados del ride + reglas de cancelación
8. Tracking de ubicación + confirmación de carga + foto de entrega
9. Integración Stripe + webhook
10. Calificaciones mutuas
11. Portal Admin

## 15. Pendiente (TODO)

| Módulo | Estado | Notas |
|--------|--------|-------|
| MongoDB Docker | ✅ Listo | `bun run db:up` |
| Auth middleware | TODO | Validar token Clerk |
| Role middleware | TODO | Verificar rol |
| Ownership middleware | TODO | Anti-IDOR |
| WebSockets | TODO | Chat real-time |
| Upload imágenes | TODO | Cloudinary/S3 |
| Google Maps | TODO | Maps API |
| Rating/Reviews | TODO | Calificaciones mutuas |
| Portal Admin | TODO | Back office |

## 16. Notas Importantes

- Seguir todas las buenas prácticas del PRD: paginación estándar, middlewares, ownership checks, rate limiting, auditoría, etc.
- El frontend debe tener rutas protegidas por rol (client / driver / admin).
- Todas las operaciones sensibles deben validar ownership en backend.
- Priorizar experiencia mobile-first (muchos usuarios usarán la plataforma desde celular).

---

**Este documento es vivo.** Actualizar según decisiones técnicas tomadas durante el desarrollo.

Referencia principal: Ver PRD "PRD-Plataforma de acarreso.md" para detalles de arquitectura, middlewares, optimizaciones, estructura de carpetas y criterios de aceptación.

---

## 17. Skills del Proyecto

Patrones probados y templates para implementar funcionalidades específicas.

| Skill | Descripción | Ubicación |
|-------|-------------|-----------|
| `clerk-auth-patterns` | Integración Clerk + MongoDB, webhooks, middleware de auth | [SKILL.md](Doc/SKILLS/clerk-auth-patterns/SKILL.md) |
| `stripe-webhook-patterns` | PaymentIntents, webhooks idempotentes, cálculo de comisiones (10%) | [SKILL.md](Doc/SKILLS/stripe-webhook-patterns/SKILL.md) |
| `hono-backend-patterns` | Backend Bun + Hono, modelos Mongoose, paginación, middlewares | [SKILL.md](Doc/SKILLS/hono-backend-patterns/SKILL.md) |

### Uso de las Skills

Cuando vayas a implementar funcionalidades específicas, carga la skill correspondiente:

```
SKILL: Load `Doc/SKILLS/hono-backend-patterns/SKILL.md` before starting.
SKILL: Load `Doc/SKILLS/clerk-auth-patterns/SKILL.md` before starting.
SKILL: Load `Doc/SKILLS/stripe-webhook-patterns/SKILL.md` before starting.
```

Cada skill incluye:
- Patrones críticos documentados
- Templates de código listos para copiar
- Commands útiles para desarrollo
- Recursos adicionales