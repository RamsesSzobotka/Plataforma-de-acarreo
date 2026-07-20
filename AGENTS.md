# AGENTS.md - Plataforma de Acarreos

Documento principal para guías de desarrollo, IA y equipo fullstack.  
Basado en el PRD "PRD-Plataforma de acarreso.md" con ajustes específicos del producto.

## 0. Sistema de Diseño

### Paleta de Colores (Turquesa + Naranja Terracotta)

| Rol | Color | Hex | Uso |
|-----|-------|-----|-----|
| **Primary** | 🌿 Verde Azulado (Turquesa) | `#0D9488` | Buttons principales, CTAs, estado "aceptado" |
| **Primary Hover** | 🌿 Verde más oscuro | `#0F766E` | Hover states |
| **Secondary** | 🟡 Naranja Terracotta | `#F97316` | Acentos, badges de precio, alertas de acción |
| **Secondary Hover** | 🟠 Naranja oscuro | `#EA580C` | Hover de acentos |
| **Success** | ✅ Verde | `#22C55E` | Estados: completado, pagado, disponible |
| **Warning** | ⚠️ Ámbar | `#F59E0B` | Pendiente, en negociación |
| **Error** | ❌ Rojo | `#EF4444` | Errores, cancelado |
| **Background Primary** | ⚪ Blanco | `#FFFFFF` | Card surfaces |
| **Background Secondary** | 🔵 Gris muy claro | `#F8FAFC` | Fondo página |
| **Background Alt** | 🔵 Gris claro | `#F1F5F9` | Headers, secciones alternate |
| **Text Primary** | 🔒 Negro azulado | `#0F172A` | Texto principal |
| **Text Secondary** | 🔒 Gris | `#334155` | Subtítulos |
| **Text Muted** | 🔒 Gris claro | `#64748B` | Placeholder, info secundaria |
| **Border** | 🔲 Gris Borde | `#E2E8F0` | Bordes inputs, separadores |

**Justificación**:
- Verde azulado (turquesa) = confianza, profesionalismo, modernos
- Naranja terracotta = acción, transporte, mudanza, tierra - diferente a Uber (verde) pero relacionado

### Tipografía

| Elemento | Fuente | Peso | Tamaño |
|----------|-------|------|--------|
| **Headings (h1-h3)** | **Plus Jakarta Sans** | 700 (Bold) | 32px/28px/24px |
| **Subheadings (h4-h6)** | **Plus Jakarta Sans** | 600 (SemiBold) | 20px/18px/16px |
| **Body** | **Inter** | 400 (Regular) | 16px |
| **Small/Caption** | **Inter** | 400 | 14px |
| **Button** | **Plus Jakarta Sans** | 600 (SemiBold) | 14px |
| **Mono (precios)** | **JetBrains Mono** | 600 | 16px |

**Recursos**:
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- [Inter](https://fonts.google.com/specimen/Inter)
- [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

### Iconos

Usar **Material Symbols** de Google Fonts:
- [Material Symbols](https://fonts.google.com/icons) - Iconos gratuitos, coherentes con Material Design
- Estilo: `rounded` por defecto (o `outlined` según contexto)
- Sizes: 20px (default), 24px (large), 16px (small)
- Se usa el estilo `rounded` por defecto para consistencia visual.

### CSS Variables

```css
:root {
  /* Primary Colors */
  --primary: #0D9488;
  --primary-hover: #0F766E;
  --secondary: #F97316;
  --secondary-hover: #EA580C;
  
  /* Semantic Colors */
  --success: #22C55E;
  --warning: #F59E0B;
  --error: #EF4444;
  
  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8FAFC;
  --bg-tertiary: #F1F5F9;
  
  /* Text */
  --text-primary: #0F172A;
  --text-secondary: #334155;
  --text-muted: #64748B;
  
  /* Borders & Shadows */
  --border: #E2E8F0;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  
  /* Radius */
  --radius: 12px;
  --radius-sm: 8px;
  
  /* Typography */
  --font-heading: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

## 0.1. Visión y Objetivo del Producto

Plataforma tipo **marketplace B2B de transporte de mercancías** que combina:
- **Experiencia Uber**: tracking en tiempo real, perfil visible del conductor, calificaciones, pago digital.
- **Experiencia Facebook Marketplace**: cliente sube múltiples imágenes, descripción rica, chat directo para negociar.

**Nombre del producto/marca**: **Carglyn** (Plataforma de Acarreos es el nombre interno del proyecto)

**Modelo de negocio**:
- **Sistema de ofertas**: Conductores proponen su precio, cliente acepta la mejor oferta
- **Target principal**: Empresas con necesidades de transporte recurrentes (B2B)
- **Conductores**: Transportistas independientes verificados con documentos
- **B2C secundario**: Mudanzas y envíos puntuales de personas naturales

**Roles principales**:
- **Client** (Cliente - empresa o persona)
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
│   │   ├── index.ts              # Entry point + WebSocket server (Bun nativo)
│   │   ├── db/
│   │   │   ├── mongo.ts          # Conexión MongoDB
│   │   │   └── migrate.ts        # Migraciones de BD
│   │   ├── models/               # 16 modelos Mongoose
│   │   │   ├── ride.ts           # Acarreos
│   │   │   ├── user.ts           # Usuarios
│   │   │   ├── driver.ts         # Conductores (con verificación)
│   │   │   ├── offer.ts          # Ofertas de precio
│   │   │   ├── message.ts        # Mensajes de chat
│   │   │   ├── rating.ts         # Calificaciones
│   │   │   ├── auditLog.ts       # Auditoría admin
│   │   │   ├── consent.ts        # Consentimiento GDPR
│   │   │   ├── notification.ts   # Notificaciones
│   │   │   ├── report.ts         # Reportes/disputas
│   │   │   ├── setting.ts        # Configuración global
│   │   │   ├── processedEvent.ts # Idempotencia Stripe
│   │   │   ├── mcp-token.ts      # Tokens MCP
│   │   │   ├── oauthToken.ts     # Tokens OAuth
│   │   │   ├── oauthClient.ts    # Clientes OAuth
│   │   │   └── driverContact.ts  # Contacto conductor-ride
│   │   ├── routes/               # 16 archivos de rutas
│   │   │   ├── health.ts        # Health check
│   │   │   ├── auth.ts          # Autenticación (webhook Clerk)
│   │   │   ├── rides.ts         # CRUD Rides + ofertas
│   │   │   ├── users.ts         # Gestión usuarios
│   │   │   ├── messages.ts      # Chat/Mensajes
│   │   │   ├── payments.ts      # Stripe
│   │   │   ├── upload.ts        # Cloudinary
│   │   │   ├── webhooks.ts      # Webhooks unificados
│   │   │   ├── admin.ts         # Portal admin
│   │   │   ├── mcp.ts           # MCP Server endpoint
│   │   │   ├── ratings.ts       # Calificaciones
│   │   │   ├── reports.ts       # Reportes PDF
│   │   │   ├── oauth.ts         # OAuth 2.0
│   │   │   ├── notifications.ts # Notificaciones
│   │   │   ├── gdpr.ts          # Cumplimiento GDPR
│   │   │   └── debug.ts         # Modo debug
│   │   ├── middleware/
│   │   │   ├── auth.ts          # Auth con Clerk JWT
│   │   │   ├── role.ts          # Validación de roles
│   │   │   ├── dualAuth.ts      # Auth dual (Clerk + API Key)
│   │   │   ├── rateLimiter.ts   # Rate limiting (120 req/min)
│   │   │   ├── monitoring.ts    # Métricas de rendimiento
│   │   │   └── index.ts         # Ownership checks
│   │   ├── services/
│   │   │   ├── ride-machine.ts  # Máquina de estados
│   │   │   ├── websocket.ts     # WebSocket manager
│   │   │   ├── redis.ts         # Redis + tracking GEO
│   │   │   ├── payment.service.ts # Stripe
│   │   │   ├── stripeMarketplace.ts # Stripe Connect
│   │   │   ├── invoice.ts       # Facturación PDF
│   │   │   ├── audit.ts         # Auditoría
│   │   │   ├── oauth.ts         # OAuth 2.0
│   │   │   ├── jwt.ts           # JWT helpers
│   │   │   ├── rating.ts        # Lógica de calificaciones
│   │   │   ├── notificationService.ts # Notificaciones push
│   │   │   ├── nearbyRidesNotifier.ts # Notificaciones cada hora
│   │   │   └── notifications/   # Email notifications (Brevo)
│   │   ├── mcp/                 # MCP Server (AI Integration)
│   │   │   ├── server.ts        # MCP server setup
│   │   │   ├── schemas.ts       # Zod schemas
│   │   │   ├── tools/           # Tool handlers
│   │   │   ├── audit.ts         # MCP audit logging
│   │   │   ├── errors.ts        # Errores tipados
│   │   │   └── types.ts         # Tipos MCP
│   │   ├── scripts/             # Scripts admin
│   │   └── utils/
│   │       ├── upload.ts        # Upload a Cloudinary
│   │       └── debugLogger.ts   # Debug mode logger
│   ├── tests/                   # Bun Test
│   ├── migrations/              # Migraciones MongoDB
│   ├── Dockerfile
│   └── tsconfig.json
│
├── frontend/                    # React + Vite (Clientes/Conductores)
│   ├── src/
│   │   ├── main.tsx             # Entry (Clerk + Stripe + Router)
│   │   ├── App.tsx              # Router + lazy routes + ConsentOverlay
│   │   ├── pages/               # 21 páginas
│   │   │   ├── Home.tsx         # Landing page
│   │   │   ├── AuthPage.tsx     # Sign-in
│   │   │   ├── CreateRide.tsx   # Crear acarreo
│   │   │   ├── MyRides.tsx      # Mis acarreos
│   │   │   ├── RideDetails.tsx  # Detalle + tracking + timeline
│   │   │   ├── Chat.tsx         # Chat + negociación
│   │   │   ├── DriverDashboard.tsx # Dashboard conductor
│   │   │   ├── DriverProfile.tsx   # Editar perfil conductor
│   │   │   ├── DriverPublicProfile.tsx # Perfil público
│   │   │   ├── RegisterDriver.tsx # Registro con documentos
│   │   │   ├── AddPaymentMethod.tsx
│   │   │   ├── PaymentHistory.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── SettingsMcp.tsx  # Tokens MCP
│   │   │   ├── Notifications.tsx
│   │   │   ├── GdprSettings.tsx
│   │   │   ├── EmailNotificationSettings.tsx
│   │   │   ├── LanguageSettings.tsx
│   │   │   ├── Privacy.tsx
│   │   │   ├── TermsAndConditions.tsx
│   │   │   └── OAuthLogin.tsx
│   │   ├── components/
│   │   │   ├── auth/            # SignInCustom
│   │   │   ├── layout/          # Layout, PageTransition
│   │   │   ├── ui/              # EmptyState, ErrorBoundary, FileUpload, etc.
│   │   │   ├── ride/            # ChatButton, RideCard, TimelineStepper
│   │   │   ├── map/             # AddressInput, RideMapModal, RouteMap, RouteMapWrapper
│   │   │   ├── payment/         # AddPaymentMethod, PaymentForm, SavePaymentMethod
│   │   │   └── profile/         # ClientProfile, DriverProfilePopup
│   │   ├── contexts/            # NotificationsContext, NotificationBadgeContext
│   │   ├── hooks/               # useDriverLocation, useRideTracking
│   │   ├── services/            # api, alerts, toast, osrm, tracking-ws
│   │   ├── i18n/                # i18n.ts + locales (es/en)
│   │   ├── types/index.ts       # TypeScript interfaces
│   │   └── styles/index.css     # Design system
│   ├── e2e/                     # Playwright E2E
│   └── vite.config.ts
│
├── admin-frontend/              # React + Vite (Admin Backoffice)
│   ├── src/pages/               # 13 páginas
│   │   ├── Dashboard.tsx        # Métricas + Recharts
│   │   ├── Users.tsx / UserDetail.tsx
│   │   ├── Drivers.tsx / DriverDetail.tsx
│   │   ├── Rides.tsx / RideDetail.tsx
│   │   ├── Payments.tsx
│   │   ├── Reports.tsx
│   │   ├── AuditLogs.tsx
│   │   ├── Disputes.tsx
│   │   ├── Settings.tsx
│   │   └── Login.tsx
│   └── package.json
│
├── Doc/                         # Documentación
├── agents/SKILLS/               # 5 skills IA
├── docker-compose.yml           # MongoDB + Redis + Backend + Frontend
└── render.yaml                  # Despliegue en Render
```

## 3. Autenticación

- Usar **Clerk** con SSO para usuarios web/móvil.
- Proveedores soportados:
  - Google
  - Microsoft
  - UTP (Universidad Tecnológica de Panamá) vía **Enterprise SSO** (SAML u OIDC)
- Roles se almacenan en metadata de Clerk y se sincronizan con MongoDB (`role`: "client" | "driver" | "admin")
- **OAuth 2.0** para el MCP Server: asistentes IA (Claude Desktop, Cline, etc.) se autentican vía API Key
- Middleware `dualAuth.ts` permite autenticación por Clerk JWT o por API Key (MCP)

## 4. Estados del Pedido (Ride)

Estados oficiales:
- `requested` → Pedido creado por el cliente, conductores proponen precio
- `accepted` → Conductor aceptó y se llegó a acuerdo (tras sistema de ofertas)
- `in_progress` → Conductor confirmó carga y comenzó el viaje (tracking activo)
- `completed` → Entrega realizada + foto subida
- `paid` → Pago confirmado vía Stripe
- `failed` → Pago falló después de `completed`
- `cancelled` → Cancelado

**Sistema de ofertas**: En `requested`, conductores proponen su precio (`POST /api/rides/:id/offers`). Cliente revisa ofertas y acepta la que prefiera.

**Reglas importantes**:
- En `requested`: Cliente puede editar o cancelar libremente.
- En `accepted`: 
  - Cliente **NO** puede editar ni cancelar.
  - Conductor **SÍ** puede cancelar (debe indicar motivo).
- En `in_progress`, `completed` o `paid`: **Ninguna de las partes** puede cancelar (solo Admin en casos excepcionales).
- En `failed`: Cliente puede reintentar el pago, volviendo a estado `requested`

## 5. Requisitos Mínimos del Pedido (Cliente)

Al crear un pedido el cliente **debe** proporcionar:

**Campos obligatorios**:
- Título o descripción corta del acarreo
- Descripción detallada
- **Múltiples imágenes** (mínimo 1, máximo 8 recomendadas) — subidas a Cloudinary
- Tipo de acarreo: `mudanza`, `electrodomésticos`, `muebles`, `productos`, `otros`
- Ubicación de partida (pickupLocation) – con mapa y búsqueda de dirección
- Ubicación de destino (dropoffLocation) – con mapa
- Precio estimado (estimatedPrice) — **orientativo**, conductores propondrán su precio
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
- **Recibir y aceptar ofertas de conductores** (sistema de ofertas)
- Chatear en tiempo real con el conductor
- **Ver tracking en vivo en mapa Leaflet** cuando el estado sea `in_progress`
- Ver foto de entrega subida por el conductor
- Confirmar entrega
- Realizar pago con Stripe
- **Gestión de métodos de pago (tarjeta)**
- Calificar al conductor (1-5 estrellas + comentario) - Solo después de `paid`
- Cancelar pedido según reglas de estado
- **Notificaciones en tiempo real**
- **Configuración de idioma (ES/EN)**
- **Portal de datos GDPR**

### 6.2 Portal Conductor / Driver (Prioridad Alta)

**Obligatorio (MVP)**:
- **Proponer precio al cliente** (sistema de ofertas)
- Ver lista de pedidos cercanos ordenados por distancia (20 km radio)
- **Notificaciones cada hora de pedidos cercanos**
- Ver detalles completos del pedido (todas las imágenes, descripción, ubicaciones)
- Ver perfil del cliente
- Chatear en tiempo real con el cliente
- Aceptar oferta seleccionada por el cliente
- Cancelar pedido en estado `accepted` (con motivo)
- Iniciar viaje (`in_progress`) después de confirmar carga
- Compartir ubicación en tiempo real mientras está `in_progress`
- Tomar y subir foto de la entrega al llegar al destino
- Calificar al cliente después de completar el servicio - Solo después de `paid`
- **Panel de pagos con comisiones visibles (90%)**
- **Dashboard con estadísticas**
- Ver historial de sus acarreos

### 6.3 Portal Admin (Prioridad Media-Alta)

- **Dashboard con métricas y gráficos (Recharts)**
- Gestión de usuarios y conductores
- Monitoreo de rides con filtros
- Gestión de pagos y **conciliación Stripe**
- **Reportes descargables PDF**
- **Logs de auditoría con filtros**
- **Gestión de disputas**
- **Modo debug toggle**
- **Configuración de tarifas y comisiones**
- Cancelaciones excepcionales

## 7. Chat entre Cliente y Conductor

- Implementado con **WebSockets nativos de Bun** (no Socket.IO).
- **3 canales WebSocket**:
  - `/ws/chat/:rideId` — Chat en tiempo real entre cliente y conductor
  - `/ws/tracking/:rideId` — Ubicación GPS del conductor en vivo
  - `/ws/user` — Notificaciones del sistema para el conductor
- Autenticación: Clerk JWT + validación de participación en la sala
- Heartbeat: ping/pong cada 30s
- Reconexión automática con cola de mensajes offline
- Mensajes guardados en MongoDB
- Disponible desde que el pedido está en `requested`

## 8. Flujo Principal del Ride

1. Cliente crea pedido → `requested`
2. Conductores ven pedido, chatean y proponen precio (`POST /api/rides/:id/offers`)
3. Cliente revisa ofertas y acepta la que prefiera
4. Conductor acepta → `accepted` (precio final acordado)
5. Conductor confirma carga e inicia viaje → `in_progress` + tracking activo
6. Conductor llega al destino, sube foto de entrega
7. Cliente confirma entrega → `completed`
8. Cliente paga → Stripe PaymentIntent + webhook → `paid`
9. Si pago falla → `failed` (cliente puede reintentar)
10. Ambas partes se califican mutuamente (solo después de `paid`)

## 9. Modelo de Datos

### rides
```typescript
{
  _id: ObjectId
  clientId: string              // clerkId
  driverId?: string
   
  title: string
  description: string
  type: 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros'
   
  images: [{ url: string, publicId?: string }]
   
  pickupLocation: {
    address: string
    type: string
    coordinates: [lng, lat]
  }
  dropoffLocation: {
    address: string
    type: string
    coordinates: [lng, lat]
  }
   
  estimatedPrice: number
  finalPrice?: number
   
  packages?: number
  weight?: number
  notes?: string
  preferredDate?: Date
   
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'failed' | 'cancelled'
   
  deliveryPhoto?: { url: string, publicId: string }
  cancellationReason?: string
   
  // Stripe
  stripePaymentIntentId?: string
  stripePaymentMethodId?: string
   
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
  // Stripe
  stripeCustomerId?: string
  stripeConnectAccountId?: string
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
  
  isAvailable: boolean
  currentLocation?: { type: 'Point', coordinates: [lng, lat] }
   
  rating: number
  totalRides: number
  isVerified: boolean
   
  createdAt: Date
  updatedAt: Date
}
```

### offers
```typescript
{
  _id: ObjectId
  rideId: string               // ID del ride
  driverId: string             // clerkId del conductor
  amount: number               // Precio propuesto
  message?: string             // Mensaje opcional
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
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

### ratings
```typescript
{
  _id: ObjectId
  rideId: string
  raterId: string         // Quién califica
  ratedId: string        // Quién recibe
  role: 'client' | 'driver'
  rating: number         // 1-5
  comment?: string
  createdAt: Date
}
```

Además de estos, existen modelos adicionales para funcionalidades específicas: `auditLog` (auditoría), `consent` (GDPR), `notification` (notificaciones), `report` (reportes/disputas), `setting` (configuración global), `processedEvent` (idempotencia Stripe), `mcp-token` (tokens MCP), `oauthToken`/`oauthClient` (OAuth 2.0), `driverContact` (contacto conductor-ride). Ver archivos en `backend/src/models/`.

## 10. Pagos y Comisiones

### Comisiones (TU GANANCIA)
- **Comisión de plataforma**: 10% del monto final del ride
- El conductor recibe: `finalPrice * 0.90` (90%)
- Tu ganancia: `finalPrice * 0.10` (10%)

### Flujo de Pago
- Cliente guarda su tarjeta como PaymentMethod vía Stripe SetupIntent.
- Se usa Stripe PaymentIntent con captura automática al confirmar entrega.
- Stripe Connect maneja los pagos a conductores (payouts).
- Backend recibe webhook de Stripe (idempotente) para confirmar `paid`.
- **Al conductor se le descuenta el 10%** automáticamente antes de transferir.
- En cancelaciones, se procesa reembolso automático vía Stripe.

## 11. API Endpoints

### Health
- `GET /health` — Estado del servidor

### Auth
- `POST /api/auth/webhook` — Webhook de Clerk (crea/actualiza usuarios)
- `GET /api/auth/me` — Usuario actual

### Rides
- `GET /api/rides` — Listar rides (filtros: status, clientId, driverId, type, location)
- `POST /api/rides` — Crear ride
- `GET /api/rides/:id` — Obtener ride
- `PATCH /api/rides/:id` — Actualizar ride
- `PATCH /api/rides/:id/status` — Cambiar estado
- `POST /api/rides/:id/accept` — Aceptar ride (driver)
- `POST /api/rides/:id/start` — Iniciar viaje
- `POST /api/rides/:id/delivery-photo` — Subir foto de entrega
- `POST /api/rides/:id/cancel` — Cancelar ride
- `POST /api/rides/:id/offers` — Proponer precio (conductor)
- `GET /api/rides/:id/offers` — Ver ofertas (cliente)
- `POST /api/rides/:id/accept-offer` — Aceptar oferta (cliente)
- `POST /api/rides/:id/confirm` — Confirmar entrega (cliente)

### Users
- `GET /api/users` — Listar usuarios (admin)
- `GET /api/users/:clerkId` — Obtener usuario
- `POST /api/users` — Crear/actualizar usuario
- `POST /api/users/register-driver` — Registrar como driver
- `GET /api/users/driver/:userId` — Perfil de driver
- `GET /api/users/driver/me` — Mi perfil de conductor
- `PATCH /api/users/driver/profile` — Actualizar perfil
- `PATCH /api/users/driver/resubmit` — Reenviar verificación
- `PATCH /api/users/driver/:userId/availability` — Disponibilidad
- `PATCH /api/users/driver/:userId/location` — Ubicación

### Messages
- `GET /api/messages/ride/:rideId` — Mensajes de un ride
- `POST /api/messages` — Enviar mensaje
- `PATCH /api/messages/ride/:rideId/read` — Marcar leídos
- `GET /api/messages/unread-count` — Contar no leídos por ride

### Payments (Stripe)
- `POST /api/payments/create-setup-intent` — Crear SetupIntent
- `POST /api/payments/create-intent` — Crear PaymentIntent
- `POST /api/payments/confirm` — Confirmar pago
- `POST /api/payments/webhook` — Webhook de Stripe
- `POST /api/payments/setup-complete` — SetupIntent completado
- `GET /api/payments/methods` — Métodos de pago guardados
- `DELETE /api/payments/methods/:id` — Eliminar método

### Webhooks (unificados)
- `POST /api/webhooks` — Webhook unificado (Clerk + Stripe)

### Admin
- `GET /api/admin/stats` — Estadísticas del dashboard
- `GET /api/admin/rides` — Todos los rides
- `GET /api/admin/users` — Todos los usuarios
- `PATCH /api/admin/users/:clerkId/role` — Cambiar rol
- `PATCH /api/admin/drivers/:clerkId/verify` — Verificar conductor
- `PATCH /api/admin/drivers/:clerkId/suspend` — Suspender conductor
- `GET /api/admin/reports` — Reportes generados
- `GET /api/admin/audit-logs` — Logs de auditoría

### Ratings
- `POST /api/ratings` — Crear calificación
- `GET /api/ratings/driver/:clerkId` — Calificaciones de un conductor
- `GET /api/ratings/client/:clerkId` — Calificaciones de un cliente
- `GET /api/ratings/ride/:rideId` — Calificaciones de un ride

### Reports
- `POST /api/reports` — Crear reporte/disputa
- `GET /api/reports` — Listar reportes (admin)
- `GET /api/reports/:id/download` — Descargar PDF

### Upload
- `POST /api/upload` — Subir imagen (Cloudinary)

### Notifications
- `GET /api/notifications` — Listar notificaciones
- `GET /api/notifications/unread-count` — Contar no leídas
- `PATCH /api/notifications/:id/read` — Marcar leída
- `PATCH /api/notifications/read-all` — Marcar todas leídas
- `PATCH /api/email-preferences` — Preferencias de email

### GDPR
- `POST /api/gdpr/consent` — Guardar consentimiento
- `GET /api/gdpr/export` — Exportar datos personales
- `DELETE /api/gdpr/account` — Eliminar cuenta

### MCP
- `POST /mcp` — MCP Server endpoint (JSON-RPC)
- `GET /mcp/manifest` — Manifest del servidor MCP

### OAuth
- `GET /oauth/authorize` — Autorización OAuth
- `POST /oauth/token` — Intercambio de token

### Debug (admin)
- `GET /api/debug/trigger-nearby-rides` — Probar notificación de rides cercanos

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
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
BREVO_API_KEY=xxxxx
ADMIN_EMAIL=admin@carglyn.com
ADMIN_PASSWORD=xxxxx
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

## 13. Scripts

### Backend
```bash
cd backend
bun run dev          # Desarrollo con watch
bun run start       # Producción
bun run db:up       # Iniciar MongoDB (Docker)
bun run db:down     # Detener MongoDB
bun run db:logs     # Ver logs de MongoDB
bun run db:init     # Crear usuario admin
bun run db:audit    # Ver logs de auditoría
bun run db:dedupe:ratings # Limpiar calificaciones duplicadas
bun run migrate     # Ejecutar migraciones pendientes
bun test            # Ejecutar tests
bun run test:watch  # Tests en modo watch
```

### Frontend
```bash
cd frontend
bun run dev         # Desarrollo
bun run build      # Build producción
bun run preview   # Preview producción
bun run test:e2e            # Tests E2E Playwright
bun run test:e2e:ui         # Playwright UI mode
bun run test:e2e:headed     # Tests con navegador visible
```

## 14. Orden de Implementación Recomendado

✅ TODO IMPLEMENTADO — El proyecto completó todas estas fases. Ver README.md para el estado actual.

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
| Auth middleware | ✅ Listo | `backend/src/middleware/auth.ts` |
| Role middleware | ✅ Listo | `backend/src/middleware/role.ts` |
| Ownership middleware | ✅ Listo | `backend/src/middleware/index.ts` |
| Register Driver | ✅ Listo | `frontend/pages/RegisterDriver.tsx` |
| Client Profile | ✅ Listo | `frontend/components/ClientProfile.tsx` |
| WebSockets Chat | ✅ Listo | Bun WebSockets nativos, 3 canales (chat/tracking/user) |
| Upload imágenes | ✅ Listo | Cloudinary via `routes/upload.ts` |
| Mapas | ✅ Listo | Leaflet + OpenStreetMap + OSRM (no Google Maps) |
| Rating/Reviews | ✅ Listo | Calificaciones mutuas via `routes/ratings.ts` |
| Portal Admin | ✅ Listo | `admin-frontend/` con 13 páginas |
| Tracking GPS | ✅ Listo | WebSocket + Redis GEO + Leaflet |
| Notificaciones | ✅ Listo | Tiempo real + Email (Brevo) + Hourly nearby rides |
| MCP Server | ✅ Listo | AI Integration con 16 tools |
| i18n | ✅ Listo | Español/Inglés con i18next |
| GDPR | ✅ Listo | Consentimiento, exportación, eliminación de cuenta |
| OAuth 2.0 | ✅ Listo | Para asistentes IA (Claude Desktop, Cline, etc.) |
| Reportes PDF | ✅ Listo | Facturación y reportes descargables |
| Auditoría Admin | ✅ Listo | Logs de acciones con filtros |
| Debug Mode | ✅ Listo | Admin toggle + logs condicionales |
| Stripe Marketplace | ✅ Listo | Payouts a conductores con Split Payments |
| Rate Limiting | ✅ Listo | 120 req/min API, 30 WS chat |
| Monitoreo | ✅ Listo | Tracking de rendimiento por ruta |
| Tests E2E | ✅ Listo | Playwright con 19+ specs |
| Tests Unitarios | ✅ Listo | Bun Test (ride-machine, rides, users, messages, offers, ratings, MCP) |

## 15.1 Sistema de Verificación de Conductores

### 15.1.1 Flujo de Verificación

```
1. Conductor se registra → verificationStatus: 'pending'
2. Redirect a /driver → ve mensaje "pendiente de verificación"
3. Admin revisa en /admin/drivers
4. Admin aprueba → verificationStatus: 'verified' → conductor puede operar
5. Admin rechaza → verificationStatus: 'rejected' + rejectionReason
6. Conductor ve razón → edita perfil → reenvía (pending)
7.循环 de nuevo
```

### 15.1.2 Estados de Verificación

| Estado | Color | Descripción |
|--------|-------|-------------|
| `pending` | Ámbar | Esperando revisión del admin |
| `in_review` | Azul | Un admin está revisando los documentos |
| `verified` | Verde | Aprobado, puede aceptar pedidos |
| `rejected` | Rojo | Rechazado, debe editar y reenviar |
| `suspended` | Rojo | Suspendido por el admin |

### 15.1.3 Restricciones por Estado

| Estado | Ver pedidos | Aceptar pedido | Chatear | Editar perfil |
|--------|------------|----------------|--------|---------------|
| pending | ✅ | ❌ (mensaje) | ✅ | ✅ |
| in_review | ✅ | ❌ (mensaje) | ✅ | ✅ |
| verified | ✅ | ✅ | ✅ | ✅ |
| rejected | ✅ | ❌ (mensaje) | ✅ | ✅ |
| suspended | ❌ | ❌ | ❌ | ❌ |

### 15.1.4 Documentos Requeridos para Registro

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

### 15.1.5 Modelo Driver Expandido

```typescript
// backend/src/models/driver.ts
{
  // === INFO BÁSICA ===
  userId: string,
  vehicleType: string,
  plate: string,
  capacityKg: number,
  
  // === DOCUMENTOS OBLIGATORIOS ===
  vehicleImages: [string],      // Fotos del vehículo
  licenseType: string,          // Tipo de licencia
  licenseImage: string,        // Foto de licencia
  cedulaFront: string,          // Cédula - frente
  cedulaBack: string,          // Cédula - reverso
  ruvDocument: string,         // RUV del vehículo
  plateImage: string,          // Foto de placa vigente
  insurancePolicy: string,    // Póliza de seguro terceros
  
  // === DOCUMENTOS OPCIONALES ===
  carneBlanco: string,         // Carné blanco
  carneVerde: string,         // Carné verde
  carneTransporteCarga: string, // Carné transporte
  fumigationCertificate: string, // Fumigación
  
  // === DATOS DE CONTACTO ===
  phone: string,               // Obligatorio
  
  // === VERIFICACIÓN ===
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended',
  rejectionReason: string,     // Por qué fue rechazado
  reviewedBy: string,         // clerkId del admin
  reviewedAt: Date,
  
  // === DISPONIBILIDAD ===
  isAvailable: boolean,
  currentLocation: { type: 'Point', coordinates: [lng, lat] },
  
  // === CALIFICACIÓN ===
  rating: number,
  totalRides: number,
  isVerified: boolean,        // Legacy - mantener por compatibilidad
}
```

### 15.1.6 Endpoints de Verificación

```
POST /api/users/register-driver   - Registrar conductor (crea pending)
GET  /api/users/driver/:userId    - Obtener perfil de conductor
PATCH /api/users/driver/profile  - Actualizar perfil y documentos
GET  /api/users/driver/me        - Mi perfil de conductor (propio)
PATCH /api/users/driver/resubmit - Reenviar a revisión (pending)
```

### 15.1.7 Frontend - RegisterDriver.tsx (Nueva estructura)

```
📋 Sección 1: Datos del Vehículo
   - Tipo de vehículo * (selector visual)
   - Placa * (input)
   - Capacidad * (input number)
   - Fotos del vehículo * (drag & drop)

📋 Sección 2: Documentos Personales
   - Tipo de licencia * (select)
   - Foto de licencia * (upload)
   - Cédula frente * (upload)
   - Cédula reverso * (upload)

📋 Sección 3: Documentos del Vehículo
   - RUV * (upload)
   - Placa vigente * (upload)
   - Póliza de seguro * (upload)

📋 Sección 4: Datos de Contacto
   - Teléfono * (input)

📋 Sección 5: Documentos Adicionales (opcionales)
   - Carné Blanco, Carné Verde, Carné Transporte, Fumigación
   - Siempre visibles, no colapsados

📋 Indicador de progreso visual
   - [✓] Completo   [○] Pendiente...
```

### 15.1.8 Driver Dashboard - Mensajes de Estado

```
pending:
┌─────────────────────────────────────────┐
│ ⚠️ Verificación Pendiente              │
│                                         │
│ Sus documentos están en revisión.      │
│ No podrá aceptar encargos hasta que      │
│ un admin apruebe su perfil.             │
│                                         │
│ Tiempo estimado: 24-48 horas            │
└─────────────────────────────────────────┘

rejected:
┌─────────────────────────────────────────┐
│ ❌ Verificación Rechazada               │
│                                         │
│ Motivo: [rejectionReason]              │
│                                         │
│ Por favor, corrija los documentos     │
│ y vuelva a enviar para revisión.     │
│                                         │
│ [Corregir y reenviar]                │
└─────────────────────────────────────────┘

verified:
┌─────────────────────────────────────────┐
│ ✅ Cuenta Verificada                   │
│                                         │
│ Ya puede comenzar a aceptar pedidos.  │
└─────────────────────────────────────────┘
```

## 16. Notas Importantes

- Seguir todas las buenas prácticas del PRD: paginación estándar, middlewares, ownership checks, rate limiting, auditoría, etc.
- El frontend debe tener rutas protegidas por rol (client / driver / admin).
- Todas las operaciones sensibles deben validar ownership en backend.
- Priorizar experiencia mobile-first (muchos usuarios usarán la plataforma desde celular).
- Toda la interfaz soporta español e inglés usando i18next + react-i18next con detección automática de idioma.
- El proyecto usa WebSockets nativos de Bun (no Socket.IO) con 3 canales: /ws/chat/:rideId, /ws/tracking/:rideId, /ws/user. Autenticación vía Clerk JWT.

### 16.1 Regla de UX: Navegabilidad

**REGLA OBLIGATORIA: Toda pagina debe tener forma de volver a la anterior.**

- Cada pagina/pantana debe tener un boton "volver" o link al contexto anterior
- Páginas standalone (como login) deben tener link al home/pagina principal
- Usar `arrow_back` de Material Symbols para botones de "volver"
- En `/sign-in`: siempre mostrar link "Volver al inicio" o logo clickeable
- En `/create-ride`: mostrar "Volver a Mis Pedidos"
- En `/ride/:id`: mostrar "Volver a [contexto]"
- NO crear páginas huerfanas sin forma de navegacion

```tsx
// Ejemplo: boton volver en cualquier pagina
<Link to="/pagina-anterior" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  <span className="material-symbols-rounded">arrow_back</span>
  Volver
</Link>

// Ejemplo: logo clickeable en paginas sin Layout
<Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  <span className="material-symbols-rounded">local_shipping</span>
  Plataforma de Acarreos
</Link>
```

---

**Este documento es vivo.** Actualizar según decisiones técnicas tomadas durante el desarrollo.

Referencia principal: Ver PRD "PRD-Plataforma de acarreso.md" para detalles de arquitectura, middlewares, optimizaciones, estructura de carpetas y criterios de aceptación.

---

## 17. Skills del Proyecto

Patrones probados y templates para implementar funcionalidades específicas.

| Skill | Descripción | Ubicación |
|-------|-------------|-----------|
| `clerk-auth-patterns` | Integración Clerk + MongoDB, webhooks, middleware de auth | [SKILL.md](agents/SKILLS/clerk-auth-patterns/SKILL.md) |
| `stripe-webhook-patterns` | PaymentIntents, webhooks idempotentes, cálculo de comisiones (10%) | [SKILL.md](agents/SKILLS/stripe-webhook-patterns/SKILL.md) |
| `hono-backend-patterns` | Backend Bun + Hono, modelos Mongoose, paginación, middlewares | [SKILL.md](agents/SKILLS/hono-backend-patterns/SKILL.md) |
| `frontend-design` | Sistema de diseño, paleta de colores, componentes, tema visual | [SKILL.md](agents/SKILLS/frontend-design/SKILL.md) |
| `readme-aesthetic-enhancer` | Mejoras estéticas y de formato para README | [SKILL.md](agents/SKILLS/readme-aesthetic-enhancer/SKILL.md) |

### Uso de las Skills

Cuando vayas a implementar funcionalidades específicas, carga la skill correspondiente:

```
SKILL: Load `agents/SKILLS/hono-backend-patterns/SKILL.md` before starting.
SKILL: Load `agents/SKILLS/clerk-auth-patterns/SKILL.md` before starting.
SKILL: Load `agents/SKILLS/stripe-webhook-patterns/SKILL.md` before starting.
```

Cada skill incluye:
- Patrones críticos documentados
- Templates de código listos para copiar
- Commands útiles para desarrollo
- Recursos adicionales