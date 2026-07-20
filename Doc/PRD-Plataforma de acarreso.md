# PRD-Plataforma de Acarreos

> **NOTA**: Este PRD fue escrito durante la fase inicial del proyecto. Para el estado actualizado del código, ver [README.md](../README.md) y [AGENTS.md](../AGENTS.md). La mayoría de los módulos aquí descritos están implementados.

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
| Base de datos | MongoDB + Redis (caching + GEO) |
| Autenticación | Clerk (SSO) + OAuth 2.0 propio |
| Pagos | Stripe (PaymentIntents + Connect Marketplace) |
| Mapas | Leaflet + OpenStreetMap + OSRM |
| Archivos | Cloudinary |
| AI / MCP | MCP Server (JSON-RPC) para integración con asistentes IA |
| Notificaciones | WebSockets nativos (Bun) + Brevo (Email) |
| Tests | Bun Test (unitarios) + Playwright (E2E) |

### 1.4 Estructura de Proyecto

```
plataforma-de-acarreo/
├── backend/                      # Bun + Hono
│   ├── src/
│   │   ├── index.ts              # Entry + WebSocket server nativo
│   │   ├── db/                   # MongoDB connection + migrations
│   │   ├── models/               # 16 modelos Mongoose
│   │   ├── routes/               # 16 archivos de rutas
│   │   ├── middleware/            # 6 middlewares (auth, role, dualAuth, rateLimiter, monitoring, index)
│   │   ├── services/              # 13 servicios (ride-machine, websocket, redis, payment, invoice, audit, oauth, jwt, rating, stripeMarketplace, notificationService, nearbyRidesNotifier, notifications/)
│   │   ├── mcp/                  # MCP Server completo
│   │   ├── scripts/              
│   │   └── utils/                
│   ├── tests/                    # Bun Test
│   ├── migrations/
│   └── ...
├── frontend/                     # React + Vite
│   ├── src/
│   │   ├── pages/                # 21 páginas
│   │   ├── components/           # 18 componentes en 7 subcarpetas
│   │   ├── hooks/                # useDriverLocation, useRideTracking
│   │   ├── contexts/             # Notifications, NotificationBadge
│   │   ├── services/             # API client, alerts, toast, osrm, tracking-ws
│   │   ├── i18n/                 # ES/EN
│   │   └── types/
│   └── e2e/                      # Playwright (19 specs)
├── admin-frontend/               # React + Vite (Admin Backoffice)
│   ├── src/pages/                # 13 páginas
│   └── package.json
├── Doc/
├── agents/SKILLS/               # 5 skills IA
├── docker-compose.yml
└── render.yaml
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
| M01 | Auth SSO (Clerk): login federado, callback, sesión, perfil autenticado | ✅ Completado |
| M02 | Usuarios y Roles: perfil, estados, RBAC y ownership | ✅ Completado |
| M03 | Portal Cliente: crear ride, seguimiento, historial paginado, pago | ✅ Completado |
| M04 | Portal Conductor: disponibilidad, aceptar ride, actualizar estados, historial | ✅ Completado |
| M05 | Rides Engine: ciclo de vida de ride, matching, reglas de estado | ✅ Completado |
| M06 | Pagos Stripe: PaymentIntent, confirmación, webhook idempotente | ✅ Completado |
| M07 | WebSockets: eventos de ride y ubicación en tiempo real | ✅ Completado |
| M08 | Back Office Admin: dashboard, gestión users/drivers/rides/payments, tarifas | ✅ Completado |
| M09 | Auditoría Admin: bitácora de acciones críticas y trazabilidad | ✅ Completado |
| M10 | Optimización: paginación, filtros, índices, cache básico | ✅ Completado |

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
- Cloudinary (Archivos)
- Brevo (Email)
- MCP Server (AI / asistentes IA via JSON-RPC)
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

### 4.2 Drivers (EXPANDIDO)
```javascript
{
  _id: ObjectId,
  userId: String,              // clerkId - único
  vehicleType: String,
  plate: String,
  capacityKg: Number,
  
  // === DOCUMENTOS OBLIGATORIOS ===
  vehicleImages: [String],      // Fotos del vehículo (mín. 1)
  licenseType: String,          // Tipo de licencia
  licenseImage: String,        // Foto de licencia
  cedulaFront: String,          // Cédula - frente
  cedulaBack: String,          // Cédula - reverso
  ruvDocument: String,         // RUV del vehículo
  plateImage: String,          // Foto de placa vigente
  insurancePolicy: String,    // Póliza de seguro terceros
  
  // === DOCUMENTOS OPCIONALES ===
  carneBlanco: String,         // Carné blanco
  carneVerde: String,         // Carné verde
  carneTransporteCarga: String, // Carné transporte
  fumigationCertificate: String, // Fumigación
  
  // === DATOS DE CONTACTO ===
  phone: String,              // Obligatorio
  
  // === VERIFICACIÓN ===
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended',
  rejectionReason: String,    // Por qué fue rechazado
  reviewedBy: String,        // clerkId del admin
  reviewedAt: Date,
  
  // === DISPONIBILIDAD ===
  isAvailable: Boolean,
  currentLocation: { type: 'Point', coordinates: [lng, lat] },
  
  // === CALIFICACIÓN ===
  rating: Number,
  totalRides: Number,
  
  createdAt: Date,
  updatedAt: Date
}
```
Índices recomendados:
- { userId: 1 } unique
- { currentLocation: '2dsphere' }
- { isAvailable: 1 }
- { verificationStatus: 1 }

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

### 7.2 Flujo de Pago y Comisiones
```
1. Backend calcula costo (tarifa base + distancia + ajustes)
2. Backend crea PaymentIntent en Stripe
3. Frontend confirma pago
4. Stripe notifica por webhook
5. Backend actualiza payment y ride de forma atómica
```

#### Comisiones de Plataforma
- **Comisión de plataforma**: 10% del monto final del ride
- El conductor recibe: `finalPrice * 0.90` (90%)
- Tu ganancia: `finalPrice * 0.10` (10%)

#### Calificaciones
- Las calificaciones (1-5 estrellas + comentario) están disponibles **solo después del pago confirmado (`paid`)**
- Ambas partes (cliente y conductor) pueden calificarse mutuamente

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
- GET /api/users/driver/me - Mi perfil de conductor (propio)
- PATCH /api/users/driver/profile - Actualizar perfil y documentos
- PATCH /api/users/driver/resubmit - Reenviar a verificación (pending)

**Admin**:
- GET /api/users - Listar usuarios
- GET /api/users/drivers - Listar drivers (con filtros por status)
- PATCH /api/users/driver/:userId/verify - Aprobar/rechazar driver
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
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
BREVO_API_KEY=xxxxx
ADMIN_EMAIL=admin@carglyn.com
PORT=3000
NODE_ENV=development
```

### Frontend (.env)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_CLOUDINARY_CLOUD_NAME=xxxxx
```

### Admin Frontend (.env)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_API_URL=http://localhost:3000
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

> Todas las fases completadas. El proyecto está en estado de mantenimiento y mejoras.

### Fase 1 - Fundación
- ✅ Setup Bun + Hono
- ✅ Conexión MongoDB
- ✅ Integración Clerk SSO
- ✅ Integración Stripe base

### Fase 2 - Operación Core
- ✅ CRUD Users/Drivers/Rides
- ✅ Flujo completo de Rides
- ✅ Matching geoespacial
- ✅ Paginación y filtros en listados

### Fase 3 - Tiempo Real y Pagos
- ✅ WebSockets nativos (3 canales: chat, tracking, user)
- ✅ Tracking GPS en vivo con Redis GEO
- ✅ Confirmación de pagos por webhook (idempotente)
- ✅ Rate limiting y hardening de seguridad

### Fase 4 - Back Office
- ✅ Dashboard con Recharts (métricas y gráficos)
- ✅ Gestión usuarios/conductores/rides/pagos
- ✅ Auditoría y reportería (PDF descargable)

### Fase 5 - Escalado
- ✅ Redis caching
- ✅ Tests backend (Bun Test) + E2E (Playwright, 19+ specs)
- ✅ CI/CD configurado en Render

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
- ✅ Back Office Admin completo (`admin-frontend/`) con 13 páginas.
- ✅ Integración Clerk (SSO) con Google, Microsoft y UTP.
- ✅ Integración Stripe con PaymentIntents, Connect Marketplace y webhook seguro.
- ✅ Matching de conductores y tracking en tiempo real (WebSockets + Redis GEO + Leaflet).
- ✅ Endpoints protegidos, auditables y optimizados con paginación.

## 18.3 Sistema de Verificación de Conductores (NUEVO)

### 18.3.1 Flujo de Verificación

```
1. Conductor se registra → verificationStatus: 'pending'
2. Redirect a /driver → ve mensaje "pendiente de verificación"
3. Admin revisa en /admin/drivers
4. Admin aprueba → verificationStatus: 'verified' → conductor puede operar
5. Admin rechaza → verificationStatus: 'rejected' + rejectionReason
6. Conductor ve razón → edita perfil → reenvía (pending)
7. Ciclo se repite
```

### 18.3.2 Estados de Verificación

| Estado | Color | Descripción |
|--------|-------|-------------|
| `pending` | Ámbar | Esperando revisión del admin |
| `in_review` | Azul | Un admin está revisando los documentos |
| `verified` | Verde | Aprobado, puede aceptar pedidos |
| `rejected` | Rojo | Rechazado, debe editar y reenviar |
| `suspended` | Rojo | Suspendido por el admin |

### 18.3.3 Restricciones por Estado

| Estado | Ver pedidos | Aceptar pedido | Chatear | Editar perfil |
|--------|------------|----------------|--------|---------------|
| pending | ✅ | ❌ (mensaje) | ✅ | ✅ |
| in_review | ✅ | ❌ (mensaje) | ✅ | ✅ |
| verified | ✅ | ✅ | ✅ | ✅ |
| rejected | ✅ | ❌ (mensaje) | ✅ | ✅ |
| suspended | ❌ | ❌ | ❌ | ❌ |

### 18.3.4 Documentos Requeridos para Registro

**Obligatorios:**
- Fotos del vehículo (mínimo 1)
- Tipo de licencia de conducir
- Foto de licencia de conducir
- Cédula de Identidad Personal (frente)
- Cédula de Identidad Personal (reverso)
- RUV del vehículo (certificado de circulación)
- Placa vigente (foto)
- Póliza de Seguro de Daños a Terceros
- Teléfono de contacto

**Opcionales (visibles para cliente y admin):**
- Carné Blanco (transporte de alimentos)
- Carné Verde (manipulación de alimentos)
- Carné de Transporte de Carga
- Certificado de Fumigación del Vehículo

### 18.3.5 Modelo Driver Expandido (MongoDB)

```javascript
{
  _id: ObjectId,
  userId: String,              // clerkId
  vehicleType: String,
  plate: String,
  capacityKg: Number,
  
  // === DOCUMENTOS OBLIGATORIOS ===
  vehicleImages: [String],      // Fotos del vehículo (mín. 1)
  licenseType: String,          // Tipo de licencia
  licenseImage: String,        // Foto de licencia
  cedulaFront: String,          // Cédula - frente
  cedulaBack: String,          // Cédula - reverso
  ruvDocument: String,         // RUV del vehículo
  plateImage: String,          // Foto de placa vigente
  insurancePolicy: String,    // Póliza de seguro terceros
  
  // === DOCUMENTOS OPCIONALES ===
  carneBlanco: String,         // Carné blanco
  carneVerde: String,         // Carné verde
  carneTransporteCarga: String, // Carné transporte
  fumigationCertificate: String, // Fumigación
  
  // === DATOS DE CONTACTO ===
  phone: String,              // Obligatorio
  
  // === VERIFICACIÓN ===
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended',
  rejectionReason: String,    // Por qué fue rechazado
  reviewedBy: String,        // clerkId del admin
  reviewedAt: Date,
  
  // === DISPONIBILIDAD ===
  isAvailable: Boolean,
  currentLocation: { type: 'Point', coordinates: [lng, lat] },
  
  // === CALIFICACIÓN ===
  rating: Number,
  totalRides: Number,
  isVerified: Boolean,       // Legacy
  
  createdAt: Date,
  updatedAt: Date
}
```

### 18.3.6 Endpoints

```
POST /api/users/register-driver   - Registrar conductor (crea pending)
GET  /api/users/driver/:userId    - Obtener perfil de conductor
PATCH /api/users/driver/profile  - Actualizar perfil y documentos
GET  /api/users/driver/me        - Mi perfil de conductor (propio)
PATCH /api/users/driver/resubmit - Reenviar a revisión (pending)
```

### 18.3.7 Frontend - RegisterDriver.tsx

Estructura con secciones:
- Sección 1: Datos del Vehículo (tipo, placa, capacidad, fotos)
- Sección 2: Documentos Personales (licencia, cédula frente/reverso)
- Sección 3: Documentos del Vehículo (RUV, placa, póliza)
- Sección 4: Datos de Contacto (teléfono)
- Sección 5: Documentos Adicionales (opcionales)

### 18.3.8 Driver Dashboard

Mensajes según estado:
- **pending**: "pendiente de verificación"
- **in_review**: "en revisión"
- **verified**: "cuenta verificada - puede aceptar pedidos"
- **rejected**: "rechazado + razón + botón reenviar"
- **suspended**: "cuenta suspendida"

---

## 19. Criterios de Aceptación por Módulo

| Módulo | Criterio |
|--------|----------|
| Auth SSO | login/callback funcional, token válido y usuario sincronizado. |
| Cliente | puede crear ride, pagar y ver historial paginado. |
| Conductor | puede aceptar ride y actualizar estado en tiempo real. |
| Verificación Driver | debe completar documentos obligatorios + verificación admin antes de operar. |
| Pagos | ride solo pasa a paid con webhook válido de Stripe. |
| Admin | puede listar/filtrar/accionar usuarios, rides y pagos con RBAC. |
| Seguridad | anti-IDOR, validaciones y rate limiting activos. |
| Escalabilidad | índices clave creados, paginación aplicada y tiempos de respuesta estables. |

---

**Este documento es vivo.** Actualizar según decisiones técnicas tomadas durante el desarrollo.