# PRD: MCP Server — Plataforma de Acarreos

> **Estado**: Planificación — 10 tools pendientes de implementar
> **Versión**: 1.1
> **Autor**: Equipo de Desarrollo
> **Fecha**: 2026-06-18

---

## 1. Resumen Ejecutivo

Servidor **MCP (Model Context Protocol)** independiente que expone 10 tools para que agentes de IA (Claude Desktop, OpenCode, Cursor, Windsurf, etc.) interactúen con la Plataforma de Acarreos. El servidor actúa como puente entre el agente de IA y el backend REST existente, permitiendo operaciones CRUD sobre acarreos, gestión de ofertas, y consultas de historial.

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Bun | 1.13.3 |
| Lenguaje | TypeScript | 5.9.3 |
| SDK MCP | `@modelcontextprotocol/sdk` | 1.29.0 |
| Validación | `zod` | 3.25.76 |
| Transporte | stdio | MCP estándar |
| HTTP Client | Fetch nativo de Bun | — |

## 3. Arquitectura General

```
                   ┌──────────────────────────────────────┐
                   │         Agente de IA                  │
                   │  (Claude / OpenCode / Cursor / etc.)  │
                   └──────────────┬───────────────────────┘
                                  │  Protocolo MCP (stdio)
                                  ▼
                   ┌──────────────────────────────────────┐
                   │         MCP Server                    │
                   │   mcp-server/                         │
                   │                                      │
                   │  ┌──────────┐  ┌──────────────────┐  │
                   │  │ index.ts │  │   tools/         │  │
                   │  │ (entry)  │  │   (10 tools)    │  │
                   │  └────┬─────┘  └──────────────────┘  │
                   │       │                               │
                   │  ┌────▼─────┐  ┌──────────────────┐  │
                   │  │ api-client│  │   schemas.ts     │  │
                   │  │ (HTTP)   │  │   (Zod)          │  │
                   │  └────┬─────┘  └──────────────────┘  │
                   └───────┼──────────────────────────────┘
                           │  HTTP + Bearer Token
                           ▼
                   ┌──────────────────────────────────────┐
                   │    Backend (Bun + Hono)              │
                   │    http://localhost:3000              │
                   │    API REST existente                 │
                   └──────────────────────────────────────┘
```

### 3.1 Flujo de Datos

1. El agente de IA invoca una tool MCP (ej. `create_ride`)
2. El MCP server recibe la llamada via stdio
3. El MCP server valida los inputs con Zod
4. El MCP server hace una petición HTTP al backend
5. El backend procesa la solicitud y devuelve la respuesta
6. El MCP server transforma la respuesta al formato MCP
7. El agente recibe el resultado y lo presenta al usuario

## 4. Autenticación

### 4.1 Estrategia

El MCP server utiliza una **API Key** generada desde el backend para autenticarse. Esta key se pasa como variable de entorno `MCP_API_KEY` y se envía en cada request como `Authorization: Bearer <MCP_API_KEY>`.

### 4.2 Endpoint Backend Requerido

Se debe crear un endpoint en el backend para generar tokens:

```
POST /api/auth/mcp-token
  → Body: { name: string, expiresInDays?: number }
  → Response: { token: string, expiresAt: string }
```

Este endpoint debe estar protegido por rol de administrador.

### 4.3 Variables de Entorno

```
MCP_API_KEY=<token_generado_desde_backend>
BACKEND_URL=http://localhost:3000
NODE_ENV=development
```

## 5. Especificación de Tools

Cada tool está definida con:
- **Nombre**: identificador único para el agente IA
- **Descripción**: explica al agente cuándo y cómo usarla
- **Input Schema**: parámetros tipados con Zod
- **Output**: lo que devuelve
- **Endpoint Backend**: a qué endpoint REST llama internamente
- **Estado**: ✅ implementado / ⏳ pendiente de implementar

---

### Tool 1: `list_my_rides`

**Descripción**: Obtiene las solicitudes de acarreo del cliente autenticado. Útil para que el cliente consulte el estado de sus publicaciones.

**Input**:
```typescript
{
  status?: 'requested' | 'negotiating' | 'accepted' | 
           'in_progress' | 'completed' | 'paid' | 'cancelled',
  page?: number,      // default: 1
  limit?: number      // default: 10, max: 50
}
```

**Output**: `{ rides: RideSummary[], total: number, page: number, limit: number }`

**Endpoint Backend**: `GET /api/rides?clientId={userId}&status={status}&page={page}&limit={limit}`

**Estado**: ⏳ Pendiente de implementar

---

### Tool 2: `create_ride`

**Descripción**: Publica una nueva solicitud de acarreo. El cliente debe proporcionar origen, destino, descripción de la carga, tipo y precio estimado. Las imágenes se pueden agregar después.

**Input**:
```typescript
{
  title: string,              // Título descriptivo del acarreo
  description: string,        // Descripción detallada de la carga
  type: 'mudanza' | 'electrodomésticos' | 'muebles' | 'productos' | 'otros',
  pickupAddress: string,      // Dirección de recogida
  pickupLat: number,          // Latitud de recogida
  pickupLng: number,          // Longitud de recogida
  dropoffAddress: string,     // Dirección de destino
  dropoffLat: number,         // Latitud de destino
  dropoffLng: number,         // Longitud de destino
  estimatedPrice: number,     // Precio sugerido en USD
  packages?: number,          // Número aproximado de bultos
  notes?: string,             // Notas especiales (frágil, requiere ayuda, etc.)
  preferredDate?: string      // Fecha preferida (ISO 8601)
}
```

**Output**: `{ ride: Ride }` — Ride creado con estado `requested`

**Endpoint Backend**: `POST /api/rides`

**Estado**: ⏳ Pendiente de implementar

---

### Tool 3: `get_ride_details`

**Descripción**: Muestra la información completa de un acarreo específico, incluyendo ubicaciones, imágenes, conductor asignado (si existe), ofertas recibidas y estado actual.

**Input**:
```typescript
{
  rideId: string    // ID del acarreo
}
```

**Output**: `{ ride: Ride }` — Ride completo con todos los campos

**Endpoint Backend**: `GET /api/rides/:id`

**Estado**: ⏳ Pendiente de implementar

---

### Tool 4: `list_available_rides`

**Descripción**: Permite a los conductores encontrar acarreos disponibles (estado `requested`) cercanos a su ubicación. Usa coordenadas geográficas y radio de búsqueda.

**Input**:
```typescript
{
  lat: number,            // Latitud del conductor
  lng: number,            // Longitud del conductor
  radiusKm?: number,      // Radio de búsqueda en km (default: 20, max: 100)
  page?: number,          // default: 1
  limit?: number          // default: 10, max: 50
}
```

**Output**: `{ rides: AvailableRide[], total: number, page: number, limit: number }`

**Endpoint Backend**: `GET /api/rides?status=requested&lat={lat}&lng={lng}&radius={radiusKm}`

**Estado**: ⏳ Pendiente de implementar

---

### Tool 5: `get_available_ride_details`

**Descripción**: El conductor ve los detalles completos de un acarreo disponible antes de decidir si envía una oferta o lo acepta. Incluye perfil público del cliente (nombre, calificación) y distancia desde la ubicación actual.

**Input**:
```typescript
{
  rideId: string,       // ID del acarreo
  lat?: number,         // Latitud del conductor (para calcular distancia)
  lng?: number          // Longitud del conductor (para calcular distancia)
}
```

**Output**: `{ ride: Ride, client: ClientProfile, distanceKm?: number }`

**Endpoint Backend**: `GET /api/rides/:id`

**Estado**: ⏳ Pendiente de implementar

---

### Tool 6: `send_offer`

**Descripción**: El conductor envía una oferta de precio para un acarreo. El cliente recibirá la oferta y podrá aceptarla o rechazarla.

**Input**:
```typescript
{
  rideId: string,       // ID del acarreo
  price: number,        // Precio propuesto por el conductor
  message?: string      // Mensaje opcional para el cliente
}
```

**Output**: `{ offer: Offer }` — Oferta creada

**Endpoint Backend**: `POST /api/rides/:id/offers` (nuevo endpoint a crear en el backend)

**Estado**: ⏳ Pendiente de implementar

---

### Tool 7: `view_offers`

**Descripción**: El cliente revisa todas las ofertas recibidas para su publicación, incluyendo el nombre del conductor, precio propuesto, calificación y mensaje.

**Input**:
```typescript
{
  rideId: string    // ID del acarreo
}
```

**Output**: `{ offers: OfferWithDriver[] }` — Lista de ofertas con datos del conductor

**Endpoint Backend**: `GET /api/rides/:id/offers` (nuevo endpoint a crear en el backend)

**Estado**: ⏳ Pendiente de implementar

---

### Tool 8: `accept_offer`

**Descripción**: El cliente acepta la oferta de un conductor, asignando oficialmente el acarreo. El estado cambia a `accepted` y se activa el chat entre ambas partes.

**Input**:
```typescript
{
  rideId: string,       // ID del acarreo
  driverId: string      // ID del conductor (clerkId)
}
```

**Output**: `{ ride: Ride }` — Ride actualizado con estado `accepted`

**Endpoint Backend**: `POST /api/rides/:id/accept`

**Estado**: ⏳ Pendiente de implementar

---

### Tool 9: `update_ride_status`

**Descripción**: El conductor actualiza el estado del servicio a medida que avanza: "en camino" (`in_progress`), "carga recogida" (mantiene `in_progress` con flag), o "entregado" (`completed` con foto opcional).

**Input**:
```typescript
{
  rideId: string,               // ID del acarreo
  newStatus: 'in_progress' | 'completed',
  statusNote?: string,          // Nota opcional sobre el estado
  deliveryPhotoBase64?: string  // Foto de entrega (base64, solo para 'completed')
}
```

**Output**: `{ ride: Ride }` — Ride con estado actualizado

**Endpoint Backend**: `POST /api/rides/:id/status`

**Estado**: ⏳ Pendiente de implementar

---

### Tool 10: `get_ride_history`

**Descripción**: Consulta el historial de acarreos completados y pagados. Tanto clientes como conductores pueden ver su historial.

**Input**:
```typescript
{
  role: 'client' | 'driver',   // Rol del usuario consultando
  page?: number,               // default: 1
  limit?: number               // default: 10, max: 50
}
```

**Output**: `{ rides: RideSummary[], total: number, page: number, limit: number }`

**Endpoint Backend**: `GET /api/rides?status=completed,paid&{role}Id={userId}`

**Estado**: ⏳ Pendiente de implementar

---

## 6. Modelo de Datos (Interfaces MCP)

```typescript
// === Ride Summary (para listas) ===
interface RideSummary {
  id: string
  title: string
  type: RideType
  status: RideStatus
  estimatedPrice: number
  finalPrice?: number
  pickupAddress: string
  dropoffAddress: string
  createdAt: string
  driverName?: string
  clientName?: string
}

// === Ride Full (para detalle) ===
interface Ride {
  id: string
  clientId: string
  driverId?: string
  title: string
  description: string
  type: RideType
  images: { url: string }[]
  pickupLocation: { address: string, coordinates: [number, number] }
  dropoffLocation: { address: string, coordinates: [number, number] }
  estimatedPrice: number
  finalPrice?: number
  packages?: number
  notes?: string
  preferredDate?: string
  status: RideStatus
  deliveryPhoto?: { url: string }
  cancellationReason?: string
  createdAt: string
  updatedAt: string
}

// === Offer ===
interface Offer {
  id: string
  rideId: string
  driverId: string
  price: number
  message?: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

// === Offer with Driver Profile ===
interface OfferWithDriver extends Offer {
  driverName: string
  driverRating: number
  driverImageUrl?: string
  driverTotalRides: number
}

// === Client Profile ===
interface ClientProfile {
  name: string
  imageUrl?: string
  rating: number
  totalRides: number
}

// === Available Ride ===
interface AvailableRide extends RideSummary {
  distanceKm: number
  clientRating: number
}

type RideType = 'mudanza' | 'electrodomésticos' | 'muebles' | 'productos' | 'otros'

type RideStatus = 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 
                  'completed' | 'paid' | 'cancelled'
```

## 7. Manejo de Errores

### 7.1 Códigos de Error

| Error | Código MCP | HTTP Status | Causa |
|-------|-----------|-------------|-------|
| Unauthorized | `UNAUTHORIZED` | 401 | Token inválido o expirado |
| Forbidden | `FORBIDDEN` | 403 | Sin permisos para la acción |
| Not Found | `NOT_FOUND` | 404 | Recurso no existe |
| Invalid Input | `INVALID_INPUT` | 400 | Datos de entrada inválidos |
| Conflict | `CONFLICT` | 409 | Estado no permite la acción |
| Backend Error | `BACKEND_ERROR` | 500 | Error interno del backend |
| Backend Unavailable | `BACKEND_UNAVAILABLE` | — | Backend caído o sin conexión |

### 7.2 Formato de Error MCP

```typescript
{
  code: string,
  message: string,
  details?: {
    httpStatus: number,
    backendMessage?: string,
    retryable: boolean
  }
}
```

### 7.3 Estrategia de Retry

- **Errores recuperables** (BACKEND_UNAVAILABLE): 2 reintentos con backoff exponencial (500ms, 2000ms)
- **Errores no recuperables** (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INVALID_INPUT, CONFLICT): Sin retry, error inmediato al agente
- **Timeout**: 10 segundos por request

## 8. Integración con Agentes

### 8.1 Claude Desktop

```json
{
  "mcpServers": {
    "plataforma-acarreos": {
      "command": "bun",
      "args": ["run", "mcp-server/src/index.ts"],
      "env": {
        "MCP_API_KEY": "<token>",
        "BACKEND_URL": "http://localhost:3000",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 8.2 OpenCode

Se agrega a la configuración raíz del proyecto (`opencode.json` o `open-code.json`):

```json
{
  "mcpServers": {
    "plataforma-acarreos": {
      "command": "bun",
      "args": ["mcp-server/src/index.ts"],
      "env": {
        "MCP_API_KEY": "<token>",
        "BACKEND_URL": "http://localhost:3000"
      }
    }
  }
}
```

### 8.3 Otros Agentes (Cursor, Windsurf, etc.)

Siguen el mismo patrón: definir un servidor MCP con comando `bun` apuntando al entry point del servidor.

## 9. Seguridad

| Aspecto | Medida |
|---------|--------|
| Token MCP | Generado por backend, configurable expiración |
| Transporte | stdio local (no expuesto a red) |
| Input Validation | Zod en cada tool |
| Logging | Solo en desarrollo, sin datos sensibles |
| Rate Limiting | Depende del backend (no implementado en MCP) |

## 10. Plan de Implementación

### 10.1 Asignación de Tools

| Tool | Archivo | Estado | Responsable |
|------|---------|--------|-------------|
| # | Tool | Archivo | Estado | Responsable |
|---|------|---------|--------|-------------|
| 1️⃣ | list_my_rides | `src/tools/list-my-rides.ts` | ⏳ Pendiente | Ramses Szobotka |
| 2️⃣ | create_ride | `src/tools/create-ride.ts` | ⏳ Pendiente | Ramses Szobotka |
| 3️⃣ | get_ride_details | `src/tools/get-ride-details.ts` | ⏳ Pendiente | Ramses Szobotka |
| 4️⃣ | list_available_rides | `src/tools/list-available-rides.ts` | ⏳ Pendiente | Justin Barrios |
| 5️⃣ | get_available_ride_details | `src/tools/get-available-ride-details.ts` | ⏳ Pendiente | Justin Barrios |
| 6️⃣ | send_offer | `src/tools/send-offer.ts` | ⏳ Pendiente | Justin Barrios |
| 7️⃣ | view_offers | `src/tools/view-offers.ts` | ⏳ Pendiente | Ramses Szobotka |
| 8️⃣ | accept_offer | `src/tools/accept-offer.ts` | ⏳ Pendiente | Ramses Szobotka |
| 9️⃣ | update_ride_status | `src/tools/update-ride-status.ts` | ⏳ Pendiente | Justin Barrios |
| 🔟 | get_ride_history | `src/tools/get-ride-history.ts` | ⏳ Pendiente | Justin Barrios |

### 10.2 Dependencias con el Backend

| Endpoint Backend | Tools que lo usan | Estado |
|------------------|-------------------|--------|
| `GET /api/rides?clientId=...` | 1️⃣ list_my_rides | ✅ Existente |
| `POST /api/rides` | 2️⃣ create_ride | ✅ Existente |
| `GET /api/rides/:id` | 3️⃣ get_ride_details, 5️⃣ get_available_ride_details | ✅ Existente |
| `GET /api/rides?status=requested&lat=&lng=&radius=` | 4️⃣ list_available_rides | ✅ Existente |
| `POST /api/rides/:id/offers` | 6️⃣ send_offer | ❌ Pendiente de crear |
| `GET /api/rides/:id/offers` | 7️⃣ view_offers | ❌ Pendiente de crear |
| `POST /api/rides/:id/accept` | 8️⃣ accept_offer | ✅ Existente |
| `PATCH /api/rides/:id/status` | 9️⃣ update_ride_status | ❌ Pendiente de crear |
| `GET /api/rides?status=completed,paid&...` | 🔟 get_ride_history | ✅ Existente |
| `POST /api/auth/mcp-token` | Todas | ❌ Pendiente de crear |

## 11. Estructura de Archivos Final

```
mcp-server/
├── package.json              # Dependencias y scripts (bun, zod, SDK MCP)
├── tsconfig.json             # Config TypeScript (target ES2022)
├── .env.example              # Variables de entorno de ejemplo
├── .env                      # Variables de entorno (gitignored)
├── .gitignore                # Ignorar node_modules, .env
├── bun.lock                  # Lockfile generado por bun install
├── docs/
│   ├── PRD-MCP-Server.md     # Este documento
│   └── ASIGNACION.md         # Separación de responsabilidades
└── src/
    ├── index.ts              # Entry point — McpServer + tool registration
    ├── api-client.ts         # Cliente HTTP genérico para backend
    ├── types.ts              # Interfaces TypeScript compartidas
    ├── schemas.ts            # Schemas Zod para validación de inputs (10 schemas)
    ├── errors.ts             # Clases de error personalizadas
    └── tools/
        ├── index.ts          # Registro centralizado de tools
        ├── list-my-rides.ts              # Tool 1  ⏳
        ├── create-ride.ts                # Tool 2  ⏳
        ├── get-ride-details.ts           # Tool 3  ⏳
        ├── list-available-rides.ts        # Tool 4  ⏳
        ├── get-available-ride-details.ts  # Tool 5  ⏳
        ├── send-offer.ts                 # Tool 6  ⏳
        ├── view-offers.ts                # Tool 7  ⏳
        ├── accept-offer.ts               # Tool 8  ⏳
        ├── update-ride-status.ts          # Tool 9  ⏳
        └── get-ride-history.ts           # Tool 10 ⏳
```

## 12. Próximos Pasos

| Tarea | Responsable |
|-------|-------------|
| 1. Implementar Tool 1 (list_my_rides) | Ramses Szobotka — `src/tools/list-my-rides.ts` |
| 2. Implementar Tool 2 (create_ride) | Ramses Szobotka — `src/tools/create-ride.ts` |
| 3. Implementar Tool 3 (get_ride_details) | Ramses Szobotka — `src/tools/get-ride-details.ts` |
| 4. Implementar Tool 4 (list_available_rides) | Justin Barrios — `src/tools/list-available-rides.ts` |
| 5. Implementar Tool 5 (get_available_ride_details) | Justin Barrios — `src/tools/get-available-ride-details.ts` |
| 6. Implementar Tool 6 (send_offer) | Justin Barrios — `src/tools/send-offer.ts` |
| 7. Implementar Tool 7 (view_offers) | Ramses Szobotka — `src/tools/view-offers.ts` |
| 8. Implementar Tool 8 (accept_offer) | Ramses Szobotka — `src/tools/accept-offer.ts` |
| 9. Implementar Tool 9 (update_ride_status) | Justin Barrios — `src/tools/update-ride-status.ts` |
| 10. Implementar Tool 10 (get_ride_history) | Justin Barrios — `src/tools/get-ride-history.ts` |
| 11. Crear endpoints backend faltantes | — `POST /api/rides/:id/offers`, `GET /api/rides/:id/offers`, `PATCH /api/rides/:id/status`, `POST /api/auth/mcp-token` |
| 12. Probar servidor completo | Ejecutar `bun run src/index.ts` y verificar listado de 10 tools |
| 13. Verificar compilación | `bun run typecheck` (tsc --noEmit) |

---

*Fin del PRD — Próximo paso: Implementación de tools 7-10 según asignación.*
