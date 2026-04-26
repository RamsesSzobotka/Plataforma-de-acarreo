# PRD-Plataforma de Acarreos

Documento orientado a ejecución por IA y equipos fullstack.

## 0. Contrato de Implementación para IA

### 0.1 Objetivo Operativo
Una IA debe poder construir el producto de extremo a extremo usando este documento como fuente principal, sin ambigüedad funcional o técnica.

### 0.2 Restricciones Obligatorias
- Mantener stack definido: React + Vite, Bun + Hono, MongoDB, Clerk SSO, Stripe.
- No reemplazar tecnologías base sin aprobación explícita.
- Implementar todos los módulos en vertical slice (backend + frontend) por historia.
- No romper contratos existentes: usar versionado o capa de compatibilidad.

### 0.3 Artefactos Mínimos que Debe Producir la IA
- API REST con seguridad y validaciones.
- Portales funcionales: cliente, conductor y admin.
- Integración SSO + Stripe webhook seguro.
- Paginación, filtros y búsqueda en listados principales.
- Pruebas mínimas por módulo (caso feliz + caso negativo).

### 0.4 Criterio Global de Completitud
El proyecto se considera completo solo si los 3 portales funcionan con backend real, pagos confirmados por webhook, control RBAC/ownership activo y módulo admin operativo con auditoría.

## 1. Visión General

### 1.1 Propósito
Construir una plataforma C2C de acarreos on-demand, tipo marketplace, que conecte clientes con conductores para mover carga de forma segura, trazable y con pago digital integrado.

### 1.2 Objetivos de Negocio
- Permitir solicitud y ejecución de acarreos entre particulares.
- Garantizar pagos seguros mediante Stripe.
- Proveer experiencia diferenciada por rol: cliente, conductor y administrador.
- Escalar operación con buenas prácticas de seguridad, observabilidad y rendimiento.

### 1.3 Stack Tecnológico (FIJO)

| Capa | Tecnología |
|------|-------------|
| Frontend | React + Vite |
| Backend | Bun + Hono |
| Base de datos | MongoDB |
| Autenticación | Clerk (SSO) |
| Pagos | Stripe |

### 1.4 Estructura de Proyecto

```
plataforma-de-acarreo/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── db/
│   │   │   └── mongo.ts         # Conexión MongoDB
│   │   ├── models/
│   │   │   ├── ride.ts
│   │   │   ├── user.ts
│   │   │   ├── driver.ts
│   │   │   └── message.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── auth.ts
│   │   │   ├── rides.ts
│   │   │   ├── users.ts
│   │   │   ├── messages.ts
│   │   │   └── payments.ts
│   │   ├── middleware/          # Por implementar
│   │   ├── services/           # Por implementar
│   │   └── utils/             # Por implementar
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker-compose.yml     # MongoDB + Redis
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── CreateRide.tsx
│   │   │   ├── MyRides.tsx
│   │   │   ├── RideDetails.tsx
│   │   │   ├── DriverDashboard.tsx
│   │   │   └── Chat.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── hooks/             # Por implementar
│   │   ├── contexts/         # Por implementar
│   │   ├── utils/           # Por implementar
│   │   └── styles/
│   │       └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── .env.example
│
└── Doc/
    └── PRD-Plataforma de acarreso.md
```

## 2. Alcance del Producto

### 2.1 Portales
- **Portal Cliente**: crear solicitudes, ver estado del viaje, historial y pagos.
- **Portal Conductor**: disponibilidad, aceptación de servicios, tracking y cierre.
- **Back Office Admin**: gestión integral de usuarios, conductores, viajes, pagos, tarifas y monitoreo operativo.

### 2.2 Funcionalidades Core
- Registro y acceso por SSO.
- Matching geoespacial de conductores.
- Flujo de viaje completo (requested → accepted → in_progress → completed → paid/cancelled).
- Cobro con Stripe y confirmación via webhook.
- Calificación mutua cliente-conductor.
- Monitoreo administrativo y acciones de moderación.

### 2.3 Módulos Obligatorios a Construir (Checklist IA)

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| M01 | Auth SSO (Clerk): login federado, callback, sesión, perfil autenticado | Pendiente |
| M02 | Usuarios y Roles: perfil, estados, RBAC y ownership | Pendiente |
| M03 | Portal Cliente: crear ride, seguimiento, historial paginado, pago | Pendiente |
| M04 | Portal Conductor: disponibilidad, aceptar ride, actualizar estados, historial | Pendiente |
| M05 | Rides Engine: ciclo de vida de ride, matching, reglas de estado | Pendiente |
| M06 | Pagos Stripe: PaymentIntent, confirmación, webhook idempotente | Pendiente |
| M07 | WebSockets: eventos de ride y ubicación en tiempo real | Pendiente |
| M08 | Back Office Admin: dashboard, gestión users/drivers/rides/payments, tarifas | Pendiente |
| M09 | Auditoría Admin: bitácora de acciones críticas y trazabilidad | Pendiente |
| M10 | Optimización: paginación, filtros, índices, cache básico | Pendiente |

## 3. Arquitectura General

### 3.1 Arquitectura de Alto Nivel
```
React + Vite
    │
    └── HTTPS (REST)
            │
            └── Bun + Hono
                    │
                    └── MongoDB

Integraciones externas:
- Clerk (Auth)
- Stripe (Pagos)
```

### 3.2 Principios Arquitectónicos
- Modularidad por dominio.
- Separación de responsabilidades (Routes, Services, Repositories).
- Seguridad por defecto (auth, RBAC, ownership checks).
- Trazabilidad end-to-end (logs, eventos de dominio, auditoría admin).

## 4. Modelo de Datos (MongoDB)

### 4.1 Users
```javascript
{
  _id: ObjectId,
  clerkId: String,           // ID único de Clerk
  email: String,
  firstName: String,
  lastName: String,
  imageUrl: String,
  role: 'client' | 'driver' | 'admin',
  isActive: Boolean,
  phone: String,
  createdAt: Date,
  updatedAt: Date
}
```
Índices recomendados:
- { clerkId: 1 } unique
- { role: 1 }

### 4.2 Drivers
```javascript
{
  _id: ObjectId,
  userId: String,              // clerkId
  vehicleType: String,
  plate: String,
  capacityKg: Number,
  isAvailable: Boolean,
  currentLocation: {
    type: 'Point',
    coordinates: [lng, lat]
  },
  rating: Number,
  totalRides: Number,
  isVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```
Índices recomendados:
- { userId: 1 } unique
- { currentLocation: '2dsphere' }
- { isAvailable: 1 }

### 4.3 Rides
```javascript
{
  _id: ObjectId,
  clientId: String,            // clerkId
  driverId: String,
  title: String,
  description: String,
  type: 'mudanza' | 'electrodomésticos' | 'muebles' | 'productos' | 'otros',
  images: [{ url: String, publicId: String }],
  pickupLocation: {
    address: String,
    coordinates: { type: 'Point', coordinates: [lng, lat] }
  },
  dropoffLocation: {
    address: String,
    coordinates: { type: 'Point', coordinates: [lng, lat] }
  },
  estimatedPrice: Number,
  finalPrice: Number,
  packages: Number,
  weight: Number,
  notes: String,
  preferredDate: Date,
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled',
  chatEnabled: Boolean,
  deliveryPhoto: { url: String, publicId: String },
  cancellationReason: String,
  createdAt: Date,
  updatedAt: Date
}
```
Índices recomendados:
- { clientId: 1, createdAt: -1 }
- { driverId: 1, createdAt: -1 }
- { status: 1 }
- { pickupLocation: '2dsphere' }

### 4.4 Messages
```javascript
{
  _id: ObjectId,
  rideId: String,
  senderId: String,
  content: String,
  read: Boolean,
  createdAt: Date
}
```
Índices recomendados:
- { rideId: 1, createdAt: 1 }

### 4.5 AdminAuditLogs
```javascript
{
  _id: ObjectId,
  adminUserId: String,
  action: String,
  resource: String,
  resourceId: String,
  before: Object,
  after: Object,
  createdAt: Date
}
```
Índice recomendado:
- { resource: 1, createdAt: -1 }

## 5. Autenticación y Autorización

### 5.1 Autenticación con Clerk (SSO)
Flujo:
1. Usuario inicia sesión desde frontend.
2. Frontend redirige al Identity Provider (IdP) via Clerk SSO.
3. El IdP autentica al usuario y devuelve código/autorización.
4. Backend valida token (id_token/access_token) con SDK Clerk.
5. Backend crea/sincroniza usuario en MongoDB.
6. Backend adjunta contexto de usuario autenticado.

Formato de token:
- Header: Authorization: Bearer <token>

### 5.2 RBAC por Roles
Roles permitidos:
- client
- driver
- admin

Reglas mínimas:
- Solo client puede crear rides.
- Solo driver puede aceptar rides.
- Solo admin puede suspender usuarios y modificar configuraciones globales.
- Todo acceso a recursos de usuario requiere validación de ownership.

### 5.3 Ownership y Anti-IDOR
Toda operación de lectura/escritura sobre entidad sensible valida que:
- entidad.userId == req.user.id, o
- req.user.role == admin

## 6. Seguridad de Plataforma

### 6.1 Seguridad de Endpoints
**Públicos**:
- GET /health
- POST /api/auth/webhook (Clerk)
- POST /api/payments/webhook (Stripe)

**Protegidos**:
- GET /api/auth/me
- POST /api/rides
- POST /api/rides/:id/accept
- GET /api/users

Requisitos comunes:
- Token válido
- Usuario activo
- Rol autorizado
- Validación de ownership según corresponda

### 6.2 Seguridad en Stripe
Webhook seguro:
- Endpoint: POST /api/payments/webhook
- Validar firma con STRIPE_WEBHOOK_SECRET
- Usar idempotencia por event.id
- No confiar en el frontend para marcar pagos
- Confirmar estado paid solo con evento oficial de Stripe

### 6.3 Hardening Básico
- Validación estricta de inputs (DTO/schema por endpoint).
- Sanitización de payloads en entrada.
- Rate limiting en endpoints de SSO/callback, creación de rides y endpoints admin sensibles.
- Manejo de errores sin stack trace en producción.
- Headers de seguridad y CORS restringido por entorno.

## 7. Flujos Funcionales

### 7.1 Flujo de Ride
```
1. Cliente crea solicitud → requested
2. Conductor ve pedido cercano, chatea y negocia → negotiating
3. Conductor acepta → accepted (precio acordado)
4. Conductor confirma carga → in_progress
5. Conductor llega al destino, sube foto de entrega
6. Cliente confirma entrega → completed
7. Cliente realiza pago → paid
8. Ambas partes se califican
```

### 7.2 Flujo de Pago
```
1. Backend calcula costo (tarifa base + distancia + ajustes)
2. Backend crea PaymentIntent en Stripe
3. Frontend confirma pago
4. Stripe notifica por webhook
5. Backend actualiza payment y ride de forma atómica
```

## 8. Tiempo Real (WebSocket)

Casos de uso:
- Disponibilidad de conductores.
- Actualización de ubicación.
- Notificación de nuevas solicitudes.
- Actualización de estado del viaje.

Eventos:
- driver:location:update
- ride:new_request
- ride:accepted
- ride:status_update

Normas:
- Validar token antes de aceptar conexión.
- Asociar socket con userId y role.
- Rate limit por canal de ubicación.

## 9. Frontend

### 9.1 Estructura Base
```
src/
├── components/     # Componentes reutilizables
├── pages/         # Páginas por rol
│   ├── Home.tsx
│   ├── CreateRide.tsx
│   ├── MyRides.tsx
│   ├── RideDetails.tsx
│   ├── DriverDashboard.tsx
│   └── Chat.tsx
├── services/      # API client
├── types/         # TypeScript interfaces
├── hooks/        # Custom hooks
├── contexts/     # React contexts
├── utils/        # Helpers
└── styles/       # Estilos globales
```

### 9.2 Reglas de UI por Rol
- Rutas protegidas por autenticación y rol.
- Layout y menú desacoplado por portal.
- Manejo centralizado de errores de API.

## 10. Back Office (Admin)

### 10.1 Módulos Administrativos
- Dashboard: métricas operativas y financieras.
- Usuarios: listar, filtrar, suspender/reactivar.
- Conductores: validación, disponibilidad, rendimiento.
- Viajes: seguimiento, cancelaciones, incidencias.
- Pagos: estado, conciliación, reintentos.
- Tarifas: configuración de tarifa base y reglas.
- Auditoría: historial de cambios administrativos.

### 10.2 Controles de Seguridad Admin
- Acceso exclusivo rol admin.
- 100% endpoints protegidos con auth + RBAC.
- Registro de auditoría en acciones críticas.

## 11. Optimización y Escalabilidad

### 11.1 Paginación Estándar
Aplicar en listados de usuarios, conductores, rides, pagos, logs.

Contrato recomendado:
- Query params: page, limit, sortBy, sortOrder, search, status
- Valores por defecto: page=1, limit=20
- Límite máximo: limit=100

Respuesta estándar:
```javascript
{
  data: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 350,
    pages: 18
  }
}
```

### 11.2 Filtros, Orden y Búsqueda
- Filtros por rol, estado, fecha, rango de monto, ciudad/zona.
- Orden por createdAt, rating, amount.
- Búsqueda por email, nombre, placa, id de ride.

### 11.3 Rendimiento de Base de Datos
- Índices compuestos para listados frecuentes.
- Proyecciones selectivas (evitar overfetch).
- Paginación por cursor en tablas de alto volumen (opcional fase avanzada).
- TTL para datos temporales no críticos (tokens de sesión, eventos efímeros).

### 11.4 Caching y Carga
- Cache de lectura para catálogos y configuraciones.
- Debounce/throttle en tracking de ubicación.
- Compresión HTTP y respuestas ligeras.

### 11.5 Resiliencia Operativa
- Reintentos controlados para integraciones externas.
- Idempotencia en operaciones de cobro y webhooks.
- Colas/eventos para tareas no críticas (notificaciones, reportes).

## 12. API Guidelines

### 12.1 Convenciones
- Versionado: /api (base)
- Respuesta uniforme: data, pagination, error
- HTTP status coherentes (200, 201, 400, 401, 403, 404, 409, 422, 500)

### 12.2 Endpoints Clave

**Cliente**:
- GET /api/rides - Listar rides del cliente
- POST /api/rides - Crear ride
- GET /api/rides/:id - Detalles del ride
- PATCH /api/rides/:id/status - Cambiar estado

**Conductor**:
- GET /api/rides?status=requested - Ver pedidos disponibles
- POST /api/rides/:id/accept - Aceptar ride
- PATCH /api/users/driver/:userId/location - Actualizar ubicación

**Admin**:
- GET /api/users - Listar usuarios
- GET /api/rides?status=completed - Listar rides completados
- GET /api/payments - Listar pagos

### 12.3 Reglas de Contrato API para IA
- Todas las listas devuelven data + pagination.
- Los errores siguen formato uniforme: { error: { message } }.
- Ningún endpoint protegido responde sin validar token, estado de usuario y rol.
- Endpoints de escritura deben validar payload y ownership cuando aplique.

## 13. Variables de Entorno

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

## 14. Scripts

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

## 15. Roadmap Técnico

### Fase 1 - Fundación
- ✅ Setup Bun + Hono
- ✅ Conexión MongoDB
- ⏳ Integración Clerk SSO
- ⏳ Integración Stripe base

### Fase 2 - Operación Core
- ⏳ CRUD Users y Drivers
- ⏳ Flujo completo de Rides
- ⏳ Matching geoespacial
- ⏳ Paginación y filtros en listados

### Fase 3 - Tiempo Real y Pagos
- ⏳ WebSockets y tracking en vivo
- ⏳ Confirmación de pagos por webhook
- ⏳ Hardening de seguridad

### Fase 4 - Back Office
- ⏳ Dashboard y módulos admin completos
- ⏳ Auditoría y reportería

### Fase 5 - Escalado
- ⏳ Optimización de consultas
- ⏳ Cache y mejoras de rendimiento
- ⏳ Pruebas integrales (manual + automatizadas)

## 16. Orden de Construcción Recomendado para IA

1. Base técnica: configuración de proyecto, env, db, middlewares globales.
2. M01 y M02: SSO, usuarios, roles, auth middleware, ownership middleware.
3. M05 + M03: motor de rides y portal cliente.
4. M04 + M07: portal conductor y realtime.
5. M06: pagos Stripe + webhook + reconciliación.
6. M08 + M09: back office admin y auditoría.
7. M10: optimización final (paginación fina, filtros, índices, rendimiento).

Regla de dependencia:
- Ningún módulo de portal se cierra sin backend operativo.
- Ningún módulo de backend se considera final sin UI conectada.
- Ningún flujo de pago se approve sin validación por webhook.

## 17. Riesgos y Mitigación

| Riesgo | Mitigación |
|-------|-----------|
| Fraude en pagos | Confirmación solo via webhook firmado |
| Acceso indebido | RBAC + ownership checks en backend |
| Fuerza bruta | Rate limiting + monitoreo de intentos |
| Degradación por volumen | Indices, paginación, cache y observabilidad |

## 18. Entregables Finales

- ✅ Backend modular con Bun + Hono + MongoDB.
- ✅ Portal Cliente funcional.
- ✅ Portal Conductor funcional.
- ⏳ Back Office Admin completo para gestión operativa.
- ⏳ Integración Clerk (SSO).
- ⏳ Integración Stripe con webhook seguro.
- ⏳ Matching de conductores y tracking en tiempo real.
- ⏳ Endpoints protegidos, auditables y optimizados con paginación.

## 19. Criterios de Aceptación por Módulo

| Módulo | Criterio |
|--------|----------|
| Auth SSO | login/callback funcional, token válido y usuario sincronizado. |
| Cliente | puede crear ride, pagar y ver historial paginado. |
| Conductor | puede aceptar ride y actualizar estado en tiempo real. |
| Pagos | ride solo pasa a paid con webhook válido de Stripe. |
| Admin | puede listar/filtrar/accionar usuarios, rides y pagos con RBAC. |
| Seguridad | anti-IDOR, validaciones y rate limiting activos. |
| Escalabilidad | índices clave creados, paginación aplicada y tiempos de respuesta estables. |

---

**Este documento es vivo.** Actualizar según decisiones técnicas tomadas durante el desarrollo.